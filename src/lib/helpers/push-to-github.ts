import { execSync } from 'child_process';
import logger from '@/lib/model/logger.js';
import publishEvent from '@/lib/helpers/publish-event.js';

async function pushToGithub(workflowId: string, workingDir: string, repoUrl: string, token: string): Promise<void> {
  const authedUrl = repoUrl.replace('https://', `https://${token}@`);

  execSync('git config user.email "agent@agentbloom.io"', { cwd: workingDir });
  execSync('git config user.name "Agent Bloom"', { cwd: workingDir });
  execSync(`git remote set-url origin ${authedUrl}`, { cwd: workingDir });
  execSync('git add -A', { cwd: workingDir });

  const status = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf-8' });

  if (!status.trim()) {
    logger.info('[push-to-github] No changes to commit, skipping push');
    return;
  }

  execSync('git commit -m "Generated workflow from spec"', { cwd: workingDir });
  execSync('git push --force -u origin main', { cwd: workingDir, stdio: 'pipe' });
}

export default pushToGithub;
