import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import publishEvent from './publish-event.js';
import logger from '../model/logger.js';

async function runGenerationAgent(
  workflowId: string,
  workingDir: string,
  spec: string,
): Promise<void> {

  const prompt = `Generate the application according to the following specification.

## Specification

${spec}

## Deployment

The production start command is \`node server/dist/server.js\`. If the application needs to run database migrations or other setup before starting, update the root \`start\` script in package.json to include those steps (e.g. \`"start": "cd server && drizzle-kit push --force && cd .. && node server/dist/server.js"\`).

The template ships a placeholder home page at \`client/src/pages/Home.tsx\` and a placeholder item page at \`client/src/pages/Item.tsx\`. Overwrite them with the workflow's actual UI. The home page should be the main entry point for the workflow's functionality. Update \`client/src/App.tsx\` routes to match.

Start by reading AGENTS.md and globbing the file layout, then implement all required changes.`;

  const systemPromptFile = path.resolve(workingDir, 'AGENTS.md');
  const systemPrompt = fs.readFileSync(systemPromptFile, 'utf-8');

  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  if (!oauthToken) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN environment variable is not set');
  }

  // Claude Code uses the OAuth token for subscription-based auth (no API
  // key billing). Do NOT pass ANTHROPIC_API_KEY — if both are present,
  // Claude Code prefers the API key and bills through it instead of the
  // subscription. ANTHROPIC_API_KEY is used by the security reviews but
  // must not leak into the Claude Code child process.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CODE_OAUTH_TOKEN: oauthToken,
  };

  delete childEnv.ANTHROPIC_API_KEY;

  const args = [
    '-p', prompt,
    '--append-system-prompt', systemPrompt,
    '--tools', 'Bash,Read,Write,Edit,Glob,Grep',
    '--output-format', 'stream-json',
    '--model', 'opus',
    '--dangerously-skip-permissions',
    '--verbose',
  ];

  const child = spawn('claude', args, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
  });

  let lastStdout = '';
  let lastStderr = '';
  let buffer = '';
  let detectedError: string | null = null;

  child.stdout.on('data', async (data: Buffer): Promise<void> => {
    const text = data.toString();
    lastStdout = text.slice(-2000);
    logger.debug({ source: 'claude-code' }, text.slice(0, 500));

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

      if (event.type === 'result' && event.is_error) {
        if (!detectedError) {
          detectedError = event.error?.message || event.result || `Claude Code result error (${event.subtype ?? 'unknown'})`;
          logger.error({ source: 'claude-code', detectedError }, 'Claude Code result event reported is_error');
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
    logger.error({ source: 'claude-code' }, text.slice(0, 500));
  });

  child.on('error', (err: Error): void => {
    logger.error({ err }, 'Failed to spawn Claude Code process');
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
      logger.error({ code, detail }, 'Claude Code exited with non-zero code');
      reject(new Error(`Claude Code exited with code ${code}: ${detail.slice(0, 500)}`));
    });
  });
}

export default runGenerationAgent;
