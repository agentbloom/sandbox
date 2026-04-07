import { spawn } from 'child_process';
import * as path from 'path';
import publishEvent from '@/lib/helpers/publish-event.js';
import logger from '@/lib/model/logger.js';

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
    '--max-turns', '100',
  ];

  const child = spawn('claude', args, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env
    },
  });

  child.stdout.on('data', (data: Buffer) => {
    logger.debug(data.toString());
  });

  child.stderr.on('data', (data: Buffer) => {
    logger.error(data.toString());
  });

  return new Promise((resolve, reject) => {
    child.on('close', async (code) => {
      if (code === 0) {
        await publishEvent(workflowId, 'generator:progress', 'Generation agent complete');
        resolve();
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });
  });
}

export default runGenerationAgent;
