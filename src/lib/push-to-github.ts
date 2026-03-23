import { execSync } from 'child_process';

async function pushToGithub(workingDir: string, repoUrl: string, token: string): Promise<void> {
  const authedUrl = repoUrl.replace('https://', `https://${token}@`);

  execSync('git config user.email "agent@agentbloom.io"', { cwd: workingDir });
  execSync('git config user.name "Agent Bloom"', { cwd: workingDir });
  execSync(`git remote set-url origin ${authedUrl}`, { cwd: workingDir });
  execSync('git add -A', { cwd: workingDir });
  execSync('git commit -m "Generated workflow from spec"', { cwd: workingDir });
  execSync('git push --force -u origin main', { cwd: workingDir, stdio: 'pipe' });
}

export default pushToGithub;
