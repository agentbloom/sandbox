import { execSync } from 'child_process';

interface TypecheckResult {
  success: boolean;
  output: string;
}

async function runTypecheck(workingDir: string): Promise<TypecheckResult> {
  const output = execSync('npx tsc --noEmit 2>&1', { cwd: workingDir, encoding: 'utf-8' });

  return { success: true, output };
}

export default runTypecheck;
