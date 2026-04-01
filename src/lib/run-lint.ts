import { execSync } from 'child_process';

interface LintResult {
  success: boolean;
  output: string;
}

async function runLint(workingDir: string): Promise<LintResult> {
  try {
    const output = execSync('pnpm run lint 2>&1', { cwd: workingDir, encoding: 'utf-8' });

    return { success: true, output };
  } catch (err) {
    const output = err instanceof Error && 'stdout' in err ? String(err.stdout) : String(err);

    return { success: false, output };
  }
}

export default runLint;
