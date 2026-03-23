import { execSync } from 'child_process';

async function cloneRepo(repoUrl: string, token: string, destination: string): Promise<void> {
  const authedUrl = repoUrl.replace('https://', `https://${token}@`);

  execSync(`git clone ${authedUrl} ${destination}`, { stdio: 'pipe' });
}

export default cloneRepo;
