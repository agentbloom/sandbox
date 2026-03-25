import { execSync } from 'child_process';

async function buildAndPushImage(workingDir: string, appName: string): Promise<string> {
  const output = execSync(
    `flyctl deploy . --build-only --remote-only --app ${appName} 2>&1`,
    { cwd: workingDir, encoding: 'utf-8' },
  );

  console.log('[BUILD OUTPUT]', output);

  const imageMatch = output.match(/image:\s*(registry\.fly\.io\/\S+)/i);

  if (!imageMatch) {
    throw new Error(`Could not parse image ref from flyctl output: ${output.slice(-500)}`);
  }

  return imageMatch[1];
}

export default buildAndPushImage;
