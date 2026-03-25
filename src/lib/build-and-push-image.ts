import { execSync } from 'child_process';

async function buildAndPushImage(workingDir: string, appName: string): Promise<string> {
  const flyApiToken = process.env.FLY_API_TOKEN!;
  const tag = `registry.fly.io/${appName}:${Date.now()}`;

  // Login to Fly registry
  try {
    execSync(
      `echo "${flyApiToken}" | buildah login --storage-driver=vfs -u x --password-stdin registry.fly.io 2>&1`,
      { encoding: 'utf-8' },
    );
  } catch (err) {
    const stderr = err instanceof Error && 'stdout' in err ? (err as { stdout: string }).stdout : '';
    console.error('[REGISTRY LOGIN FAILED]', stderr);
    throw new Error(`Registry login failed: ${stderr.slice(-500)}`);
  }

  // Build the image
  try {
    const buildOutput = execSync(
      `buildah bud --storage-driver=vfs -t ${tag} . 2>&1`,
      { cwd: workingDir, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
    );

    console.log('[BUILD OUTPUT]', buildOutput);
  } catch (err) {
    const stderr = err instanceof Error && 'stdout' in err ? (err as { stdout: string }).stdout : '';
    console.error('[BUILD FAILED]', stderr);
    throw new Error(`Image build failed: ${stderr.slice(-500)}`);
  }

  // Push the image
  try {
    const pushOutput = execSync(
      `buildah push --storage-driver=vfs ${tag} 2>&1`,
      { encoding: 'utf-8' },
    );

    console.log('[PUSH OUTPUT]', pushOutput);
  } catch (err) {
    const stderr = err instanceof Error && 'stdout' in err ? (err as { stdout: string }).stdout : '';
    console.error('[PUSH FAILED]', stderr);
    throw new Error(`Image push failed: ${stderr.slice(-500)}`);
  }

  return tag;
}

export default buildAndPushImage;
