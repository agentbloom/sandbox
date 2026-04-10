import { execSync } from 'child_process';
import logger from '../model/logger.js';

interface WorkflowConfig {
  agent?: boolean;
  db?: boolean;
  queue?: boolean;
  email?: boolean;
  cron?: boolean;
}

// Runs the stack template's `template:configure` script with --no-* flags
// derived from workflow.config so the generator never has to delete unused
// boilerplate. The script is plain Node and runs without dependencies, so
// it can execute BEFORE pnpm install.
async function configureTemplate(workingDir: string, workflowConfig: string): Promise<void> {
  let config: WorkflowConfig = {};

  if (workflowConfig) {
    try {
      config = JSON.parse(workflowConfig) as WorkflowConfig;
    } catch (error) {
      logger.warn({ err: error }, 'Failed to parse WORKFLOW_CONFIG, skipping template:configure');
      return;
    }
  }

  const flags: string[] = [];

  if (config.db === false) flags.push('--no-db');
  if (config.queue === false) flags.push('--no-queue');
  if (config.email === false) flags.push('--no-email');
  if (config.cron === false) flags.push('--no-cron');
  if (config.agent === false) flags.push('--no-agent');

  if (flags.length === 0) {
    logger.info('All features enabled — skipping template:configure');
    return;
  }

  const command = `node scripts/configure.mjs ${flags.join(' ')}`;

  logger.info({ command }, 'Running template:configure');

  try {
    const output = execSync(command, { cwd: workingDir, stdio: 'pipe' });
    logger.info({ output: output.toString() }, 'template:configure complete');
  } catch (error) {
    logger.error({ err: error }, 'template:configure failed');
    throw error;
  }
}

export default configureTemplate;
