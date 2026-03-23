import { execSync } from 'child_process';

interface LintResult {
  success: boolean;
  output: string;
}

async function runLint(workingDir: string): Promise<LintResult> {
  const output = execSync('npm run lint 2>&1', { cwd: workingDir, encoding: 'utf-8' });

  return { success: true, output };
}

export default runLint;
