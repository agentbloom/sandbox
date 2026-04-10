import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import publishEvent from './publish-event.js';
import logger from '../model/logger.js';

const SYSTEM_PROMPT_FILE = path.resolve(__dirname, '../../../docs/SYSTEM_PROMPT.md');

async function runGenerationAgent(
  workflowId: string,
  workingDir: string,
  spec: string,
  workflowConfig: string,
): Promise<void> {

  let configSection = '';

  if (workflowConfig) {
    try {
      const config = JSON.parse(workflowConfig);
      const lines: string[] = [];

      if (!config.db) lines.push('- **Database**: NOT required. Remove all Drizzle ORM code, schema files (`src/db/`), database connections, db-related dependencies from package.json (`drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`), and db-related scripts from package.json (`db:push`, `db:generate`, `db:migrate`, `db:studio`).');
      if (!config.queue) lines.push('- **Queue/Redis**: NOT required. Remove all BullMQ/Redis code, queue connections, and queue-related dependencies from package.json (`bullmq`, `ioredis`).');
      if (!config.email) lines.push('- **Email**: NOT required. Remove all Resend code, email templates, and email-related dependencies from package.json (`resend`).');
      if (!config.cron) lines.push('- **Cron/Scheduling**: NOT required. Remove all cron job registration, scheduling code, instrumentation hooks (`src/instrumentation.ts`), and cron-related dependencies from package.json (`cron`, `node-cron`).');
      if (!config.agent) lines.push('- **AI Agent**: NOT required. Remove all Mastra agent code, tool definitions, and AI-related dependencies from package.json (`@mastra/core`, `@ai-sdk/openai`).');

      if (lines.length > 0) {
        configSection = `\n\n## Infrastructure Config\n\nThe following features are NOT enabled for this workflow. You MUST remove all related code, files, dependencies, and package.json scripts:\n\n${lines.join('\n')}\n\nOnly keep code for features that are enabled. Ensure package.json only contains dependencies and scripts for enabled features.`;
      }
    } catch {
      // invalid config JSON, skip
    }
  }

  const prompt = `Generate the application according to the following specification.

## Specification

${spec}${configSection}

## Deployment

The production start command is \`pnpm start\`. If the application needs to run database migrations or other setup before starting, update the \`start\` script in package.json to include those steps (e.g. \`"start": "drizzle-kit push --force && next start"\`).

Start by reading the existing codebase structure, then implement all required changes.`;

  // qwen-code's --append-system-prompt takes a STRING, not a file path
  // (unlike Claude Code's --append-system-prompt-file). Read the file
  // ourselves and pass the contents inline.
  const systemPrompt = fs.readFileSync(SYSTEM_PROMPT_FILE, 'utf-8');

  const qwenApiKey = process.env.QWEN_API_KEY;
  const qwenBaseUrl = process.env.QWEN_BASE_URL;

  if (!qwenApiKey) {
    throw new Error('QWEN_API_KEY environment variable is not set');
  }

  if (!qwenBaseUrl) {
    throw new Error('QWEN_BASE_URL environment variable is not set');
  }

  // qwen-code only reads OPENAI_API_KEY/OPENAI_BASE_URL from the env at
  // runtime; the corresponding --openai-api-key / --openai-base-url CLI
  // flags are accepted by yargs but not actually wired into the auth
  // resolver. We translate from QWEN_* to OPENAI_* at the spawn boundary
  // so OPENAI_* never exists in the broader process environment, only in
  // the qwen-code child process.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OPENAI_API_KEY: qwenApiKey,
    OPENAI_BASE_URL: qwenBaseUrl,
  };

  // Each --allowed-tools flag accepts a single value; repeating the flag is
  // the only safe way to pass an array via yargs without ambiguity.
  const allowedToolsFlags = [
    '--allowed-tools', 'run_shell_command',
    '--allowed-tools', 'read_file',
    '--allowed-tools', 'write_file',
    '--allowed-tools', 'edit',
    '--allowed-tools', 'glob',
    '--allowed-tools', 'grep_search',
  ];

  const args = [
    '--auth-type', 'openai',
    '-m', 'qwen3-coder-plus',
    '-p', prompt,
    '--append-system-prompt', systemPrompt,
    ...allowedToolsFlags,
    '--output-format', 'stream-json',
    '--max-session-turns', '50',
    '--approval-mode', 'yolo',
  ];

  const child = spawn('qwen', args, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
  });

  let lastStdout = '';
  let lastStderr = '';
  let buffer = '';
  // Captured the moment we detect a fatal upstream error (an [API Error: ...]
  // wrapped in an assistant text block, or a result event with is_error: true).
  // The close handler reads this and rejects so the outer try/catch in
  // sandbox/src/index.ts can route through createError → generator:failed.
  let detectedError: string | null = null;

  child.stdout.on('data', async (data: Buffer): Promise<void> => {
    const text = data.toString();
    lastStdout = text.slice(-2000);
    logger.debug({ source: 'qwen-code' }, text.slice(0, 500));

    // qwen-code emits one JSON object per line in stream-json mode (same
    // schema as Claude Code's stream-json — type: "assistant" with
    // message.content[] blocks). We only surface human-readable assistant
    // text — no token deltas, no tool calls, no system messages — to keep
    // the chat readable while still giving the user a sense of what the
    // generator is saying.
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      let event: {
        type?: string;
        subtype?: string;
        is_error?: boolean;
        result?: string;
        error?: { message?: string };
        message?: { content?: Array<{ type?: string; text?: string }> };
      };

      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }

      // Path 1: qwen-code emits a `result` event with is_error: true when it
      // gives up on a turn (network error, timeout, hard model failure).
      if (event.type === 'result' && event.is_error) {
        if (!detectedError) {
          detectedError = event.error?.message || event.result || `qwen-code result error (${event.subtype ?? 'unknown'})`;
          logger.error({ source: 'qwen-code', detectedError }, 'qwen-code result event reported is_error');
          child.kill('SIGTERM');
        }

        continue;
      }

      if (event.type !== 'assistant' || !event.message?.content) {
        continue;
      }

      for (const block of event.message.content) {
        if (block.type !== 'text' || !block.text) {
          continue;
        }

        // Path 2: qwen-code wraps upstream LLM API errors (4xx/5xx from the
        // OpenAI-compatible endpoint) as assistant text content of the form
        // `[API Error: <status> <message>]`. The CLI exits 0 in that case, so
        // the close handler can't catch it — we have to detect it here.
        if (block.text.trimStart().startsWith('[API Error')) {
          if (!detectedError) {
            detectedError = block.text.trim();
            logger.error({ source: 'qwen-code', detectedError }, 'qwen-code surfaced an upstream API error');
            child.kill('SIGTERM');
          }

          continue;
        }

        // Strip trailing colons — the chat renders each message as a standalone
        // bubble and a dangling colon looks broken. Also strips any trailing
        // whitespace/punctuation noise around the colon.
        const message = block.text.trim().replace(/[\s:]+$/, '');

        if (message.length < 2) {
          continue;
        }

        try {
          await publishEvent(workflowId, 'generator:progress', message);
        } catch {
          // non-fatal
        }
      }
    }
  });

  child.stderr.on('data', (data: Buffer): void => {
    const text = data.toString();
    lastStderr = text.slice(-2000);
    logger.error({ source: 'qwen-code' }, text.slice(0, 500));
  });

  child.on('error', (err: Error): void => {
    logger.error({ err }, 'Failed to spawn qwen-code process');
  });

  return new Promise((resolve, reject) => {
    child.on('close', async (code: number | null): Promise<void> => {
      if (detectedError) {
        reject(new Error(detectedError));
        return;
      }

      if (code === 0) {
        try {
          await publishEvent(workflowId, 'generator:progress', 'Generation agent complete');
        } catch {
          // non-fatal
        }

        resolve();
        return;
      }

      const detail = lastStderr || lastStdout || 'No output captured';
      logger.error({ code, detail }, 'qwen-code exited with non-zero code');
      reject(new Error(`qwen-code exited with code ${code}: ${detail.slice(0, 500)}`));
    });
  });
}

export default runGenerationAgent;
