import * as fs from 'fs';
import * as path from 'path';
import logger from '../model/logger.js';
import makeAiCall from './make-ai-call.js';
import createError from './create-error.js';

const PROMPT_FILE = path.resolve(__dirname, '../../../docs/SPEC_SECURITY_REVIEW_PROMPT.md');

async function runSpecSecurityReview(workflowId: string, spec: string): Promise<void> {
  const promptTemplate = fs.readFileSync(PROMPT_FILE, 'utf-8');
  const prompt = promptTemplate.replace('{{spec}}', spec || '(empty)');

  let result;

  try {
    result = await makeAiCall('claude-haiku-4-5-20251001', [{ role: 'user', content: prompt }]);
  } catch (error) {
    logger.error({ err: error }, '[spec-security-review] Failed to call Anthropic API');
    return;
  }

  const text = result.content?.[0]?.text?.trim() || '';
  const firstLine = text.split('\n')[0].trim().toUpperCase();

  logger.info(`[spec-security-review] Result: ${firstLine}`);

  if (firstLine === 'FAIL') {
    await createError(workflowId, 'Spec security review failed — potential security violation detected', new Error(text));
  }
}

export default runSpecSecurityReview;
