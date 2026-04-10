import { execSync } from 'child_process';

async function installDependencies(workingDir: string): Promise<void> {
  // --no-frozen-lockfile because the configure step may have removed
  // dependencies from package.json before this runs, leaving the lockfile
  // out of sync.
  execSync('pnpm install --no-frozen-lockfile', { cwd: workingDir, stdio: 'pipe' });
}

export default installDependencies;
