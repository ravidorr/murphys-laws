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

// A root-relative image named in the page markup, structured data or the build script must be a file in web/public,
// or crawlers get a 404. Paths may sit in a folder, such as social/home.png.
describe('image URLs built from SITE_URL or baseUrl', () => {
  const files = [...sourceFiles(join(webRoot, 'src')), ...sourceFiles(join(webRoot, 'scripts'))];
  const references = files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\$\{(?:SITE_URL|baseUrl)\}\/([A-Za-z0-9._/-]+\.(?:png|jpe?g|gif|webp|svg|ico))/g)].map(
      (match) => match[1] as string,
    ),
  );

  it('finds root and folder image references', () => {
    expect(references).toContain('android-chrome-512x512.png');
    expect(references.some((name) => name.includes('/'))).toBe(true);
  });

  it.each([...new Set(references)])('%s exists in web/public', (name) => {
    expect(existsSync(join(publicDir, name))).toBe(true);
  });
});
