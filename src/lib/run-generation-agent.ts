import { spawn } from 'child_process';
import * as path from 'path';
import sendWebhookNotification from './send-webhook-notification.js';

const SYSTEM_PROMPT_FILE = path.resolve(__dirname, '../../docs/SYSTEM_PROMPT.md');

async function runGenerationAgent(
  workflowId: string,
  workingDir: string,
  specMarkdown: string,
  chatTranscript: string,
): Promise<void> {

  const prompt = `Generate the application according to the following specification.

## Specification

${specMarkdown}

## Conversation Context

${chatTranscript}

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
            await sendWebhookNotification(workflowId, 'info', `Tool: ${streamEvent.content_block.name}`);
          }

          // Text delta (subtitle/status messages)
          if (streamEvent.type === 'content_block_delta' && streamEvent.delta?.type === 'text_delta' && streamEvent.delta.text) {
            await sendWebhookNotification(workflowId, 'info', streamEvent.delta.text);
          }
        }

        // Complete assistant messages
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              await sendWebhookNotification(workflowId, 'info', block.text);
            } else if (block.type === 'tool_use') {
              await sendWebhookNotification(workflowId, 'info', `Tool: ${block.name}`);
            }
          }
        }

        // System messages
        if (event.type === 'system' && event.message) {
          await sendWebhookNotification(workflowId, 'info', event.message);
        }
      } catch {
        // not valid JSON, skip
      }
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    console.error(data.toString());
  });

  return new Promise((resolve, reject) => {
    child.on('close', async (code) => {
      if (code === 0) {
        await sendWebhookNotification(workflowId, 'info', 'Generation agent complete');
        resolve();
      } else {
        reject(new Error(`Claude Code exited with code ${code}`));
      }
    });
  });
}

export default runGenerationAgent;
