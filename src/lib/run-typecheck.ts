import { execSync } from 'child_process';

interface TypecheckResult {
  success: boolean;
  output: string;
}

async function runTypecheck(workingDir: string): Promise<TypecheckResult> {
  try {
    const output = execSync('npx tsc --noEmit 2>&1', { cwd: workingDir, encoding: 'utf-8' });

    return { success: true, output };
  } catch (err) {
    const output = err instanceof Error && 'stdout' in err ? String(err.stdout) : String(err);

    return { success: false, output };
  }
}

export default runTypecheck;
