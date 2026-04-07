import * as fs from 'fs';
import * as path from 'path';
import createError from '@/lib/helpers/create-error.js';

async function getFiles(workflowId: string, dir: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        results.push(...await getFiles(workflowId, fullPath, extensions));
      } else if (entry.isFile() && extensions.some(e => entry.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    await createError(workflowId, 'Failed to read files', err);
  }

  return results;
}

export default getFiles;
