import { execSync } from 'child_process';

async function buildAndPushImage(workingDir: string, appName: string): Promise<string> {
  const output = execSync(
    `flyctl deploy . --build-only --remote-only --app ${appName}`,
    { cwd: workingDir, encoding: 'utf-8', stdio: 'pipe' },
  );

  const imageMatch = output.match(/image:\s*(registry\.fly\.io\/\S+)/i);

  if (imageMatch) {
    return imageMatch[1];
  }

  return `registry.fly.io/${appName}:latest`;
}

export default buildAndPushImage;
