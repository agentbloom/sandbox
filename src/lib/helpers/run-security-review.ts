import * as fs from 'fs';
import * as path from 'path';
import logger from '../model/logger.js';
import anthropic from '../model/anthropic.js';
import publishEvent from './publish-event.js';
import createError from './create-error.js';
import getFiles from './get-files.js';

const PROMPT_FILE = path.resolve(__dirname, '../../../docs/CODE_SECURITY_REVIEW_PROMPT.md');

// Hard caps to keep the security review prompt within a reasonable token
// budget. The full src/ tree of a generated app can run to hundreds of
// thousands of tokens; we cap each file and the total to keep one Sonnet
// call cheap and bounded.
const MAX_FILE_BYTES = 12_000;
const MAX_TOTAL_BYTES = 150_000;

async function runSecurityReview(workflowId: string, workingDir: string): Promise<void> {
  const files = await getFiles(workflowId, path.join(workingDir, 'src'), ['.ts', '.tsx']);

  if (files.length === 0) {
    return;
  }

  let fileContents = '';
  let truncated = false;

  for (const f of files) {
    const relativePath = path.relative(workingDir, f);
    const raw = fs.readFileSync(f, 'utf-8');
    const trimmed = raw.length > MAX_FILE_BYTES
      ? `${raw.slice(0, MAX_FILE_BYTES)}\n... (truncated, ${raw.length - MAX_FILE_BYTES} more bytes) ...`
      : raw;
    const block = `--- ${relativePath} ---\n${trimmed}\n\n`;

    if (fileContents.length + block.length > MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }

    fileContents += block;
  }

  if (truncated) {
    fileContents += '--- (additional files omitted to stay within review budget) ---\n';
  }

  const promptTemplate = fs.readFileSync(PROMPT_FILE, 'utf-8');
  const prompt = promptTemplate.replace('{{fileContents}}', fileContents);

  let result;

  try {
    result = await anthropic.createMessage('claude-sonnet-4-20250514', [{ role: 'user', content: prompt }]);
  } catch (error) {
    logger.error({ err: error }, '[security-review] Failed to call Anthropic API');
    return;
  }

  const text = result.content?.[0]?.text?.trim() || '';
  const firstLine = text.split('\n')[0].trim().toUpperCase();

  logger.info(`[security-review] Result: ${firstLine}`);

  if (firstLine === 'FAIL') {
    await createError(workflowId, 'Security review failed', new Error(text));
  }
}

export default runSecurityReview;
