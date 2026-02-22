import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const HUSKY_DIR = path.resolve('.husky');
const INTERNAL_DIR = '_';

function stripDeprecated(content: string): string {
  let out = content.replace(/^#!\/usr\/bin\/env sh\s*\n/gm, '');
  out = out.replace(/^\.\s+"\$\(dirname -- "\$0"\)\/_\/husky\.sh"\s*\n/gm, '');
  out = out
    .split('\n')
    .filter((line) => !line.includes('_/husky.sh'))
    .join('\n');
  out = out.replace(/^\s*\n+/, '');
  if (!out.endsWith('\n')) out += '\n';
  return out;
}

async function sanitizeFile(filePath: string): Promise<boolean> {
  const before = await readFile(filePath, 'utf8');
  const after = stripDeprecated(before);
  if (after !== before) {
    await writeFile(filePath, after, 'utf8');
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  try {
    const entries = await readdir(HUSKY_DIR, { withFileTypes: true });
    let changed = 0;
    for (const entry of entries) {
      if (entry.name === INTERNAL_DIR) continue;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(HUSKY_DIR, entry.name);
      const st = await stat(full);
      if (st.isFile()) {
        const did = await sanitizeFile(full);
        if (did) changed++;
      }
    }
    if (changed > 0) {
      console.log(`Sanitized ${changed} Husky hook(s).`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Husky sanitize warning:', message);
  }
}

main();
