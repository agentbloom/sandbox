import { spawn } from 'child_process';
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
      if (!config.agent) lines.push('- **AI Agent**: NOT required. Remove all Mastra agent code, tool definitions, and AI-related dependencies from package.json (`@mastra/core`, `@ai-sdk/anthropic`).');

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

  const args = [
    '-p', prompt,
    '--append-system-prompt-file', SYSTEM_PROMPT_FILE,
    '--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--max-turns', '20',
  ];

  const child = spawn('claude', args, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env
    },
  });

  let lastStdout = '';
  let lastStderr = '';
  let buffer = '';

  child.stdout.on('data', async (data: Buffer): Promise<void> => {
    const text = data.toString();
    lastStdout = text.slice(-2000);
    logger.debug({ source: 'claude-code' }, text.slice(0, 500));

    // Claude Code emits one JSON object per line in stream-json mode.
    // We only surface human-readable assistant text — no token deltas, no
    // tool calls, no system messages — to keep the chat readable while still
    // giving the user a sense of what the generator is saying.
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      let event: { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };

      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (event.type !== 'assistant' || !event.message?.content) {
        continue;
      }

      for (const block of event.message.content) {
        if (block.type !== 'text' || !block.text) {
          continue;
        }

        const message = block.text.trim();

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
    logger.error({ source: 'claude-code' }, text.slice(0, 500));
  });

  child.on('error', (err: Error): void => {
    logger.error({ err }, 'Failed to spawn Claude Code process');
  });

  return new Promise((resolve, reject) => {
    child.on('close', async (code: number | null): Promise<void> => {
      if (code === 0) {
        try {
          await publishEvent(workflowId, 'generator:progress', 'Generation agent complete');
        } catch {
          // non-fatal
        }

        resolve();
      } else {
        const detail = lastStderr || lastStdout || 'No output captured';
        logger.error({ code, detail }, 'Claude Code exited with non-zero code');
        reject(new Error(`Claude Code exited with code ${code}: ${detail.slice(0, 500)}`));
      }
    });
  });
}

export default runGenerationAgent;
