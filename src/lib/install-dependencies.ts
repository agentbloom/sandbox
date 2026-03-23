import { execSync } from 'child_process';

async function installDependencies(workingDir: string): Promise<void> {
  execSync('npm install', { cwd: workingDir, stdio: 'pipe' });
}

export default installDependencies;
