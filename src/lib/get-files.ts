import * as fs from 'fs';
import * as path from 'path';

function getFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        results.push(...getFiles(fullPath, extensions));
      } else if (entry.isFile() && extensions.some(e => entry.name.endsWith(e))) {
        results.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist
  }

  return results;
}

export default getFiles;
