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

      if (!config.db) lines.push('- **Database**: NOT required. Remove all Drizzle ORM code, schema files, database connections, and db-related dependencies.');
      if (!config.queue) lines.push('- **Queue/Redis**: NOT required. Remove all BullMQ/Redis code, queue connections, and queue-related dependencies.');
      if (!config.email) lines.push('- **Email**: NOT required. Remove all Resend code, email templates, and email-related dependencies.');
      if (!config.cron) lines.push('- **Cron/Scheduling**: NOT required. Remove all cron job registration, scheduling code, and instrumentation hooks.');
      if (!config.agent) lines.push('- **AI Agent**: NOT required. Remove all Mastra agent code, tool definitions, and AI-related dependencies.');

      if (lines.length > 0) {
        configSection = `\n\n## Infrastructure Config\n\nThe following features are NOT enabled for this workflow. Remove all related code, files, and dependencies:\n\n${lines.join('\n')}\n\nOnly keep code for features that are enabled.`;
      }
    } catch {
      // invalid config JSON, skip
    }
  }

  const prompt = `Generate the application according to the following specification.

## Specification

${spec}${configSection}

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

  child.stdout.on('data', async (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const event = JSON.parse(line);

        // Stream events — tool starts and text deltas
        if (event.type === 'stream_event' && event.event) {
          const streamEvent = event.event;

          // Tool use started
          if (streamEvent.type === 'content_block_start' && streamEvent.content_block?.type === 'tool_use') {
            await publishEvent(workflowId, 'generator:progress', `Tool: ${streamEvent.content_block.name}`);
          }

          // Text delta (subtitle/status messages)
          if (streamEvent.type === 'content_block_delta' && streamEvent.delta?.type === 'text_delta' && streamEvent.delta.text) {
            await publishEvent(workflowId, 'generator:progress', streamEvent.delta.text);
          }
        }

        // Complete assistant messages
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              await publishEvent(workflowId, 'generator:progress', block.text);
            } else if (block.type === 'tool_use') {
              await publishEvent(workflowId, 'generator:progress', `Tool: ${block.name}`);
            }
          }
        }

        // System messages
        if (event.type === 'system' && event.message) {
          await publishEvent(workflowId, 'generator:progress', event.message);
        }
      } catch {
        // not valid JSON, skip
      }
    }
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
