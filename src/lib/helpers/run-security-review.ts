import * as fs from 'fs';
import * as path from 'path';
import logger from '../model/logger.js';
import anthropic from '../model/anthropic.js';
import publishEvent from './publish-event.js';
import createError from './create-error.js';
import getFiles from './get-files.js';

const PROMPT_FILE = path.resolve(__dirname, '../../../docs/CODE_SECURITY_REVIEW_PROMPT.md');

async function runSecurityReview(workflowId: string, workingDir: string): Promise<void> {
  await publishEvent(workflowId, 'generator:progress', 'Running security review...');

  const files = await getFiles(workflowId, path.join(workingDir, 'src'), ['.ts', '.tsx']);

  if (files.length === 0) {
    return;
  }

  const fileContents = files.map(f => {
    const relativePath = path.relative(workingDir, f);
    const content = fs.readFileSync(f, 'utf-8');
    return `--- ${relativePath} ---\n${content}`;
  }).join('\n\n');

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
