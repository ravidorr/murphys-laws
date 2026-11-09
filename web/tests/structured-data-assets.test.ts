import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '..');
const publicDir = join(webRoot, 'public');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

// A root-level image named in the page markup or structured data must be a file in web/public, or crawlers get a 404.
describe('root image URLs built from SITE_URL', () => {
  const references = sourceFiles(join(webRoot, 'src')).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\$\{SITE_URL\}\/([A-Za-z0-9._-]+\.(?:png|jpe?g|gif|webp|svg|ico))/g)].map(
      (match) => ({ file: file.slice(webRoot.length + 1), name: match[1] as string }),
    ),
  );

  it('finds the logo references', () => {
    expect(references.length).toBeGreaterThan(0);
  });

  it.each([...new Set(references.map((reference) => reference.name))])('%s exists in web/public', (name) => {
    expect(existsSync(join(publicDir, name))).toBe(true);
  });
});
