import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function declarations(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const map = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+?)\s*(?:\/\*.*?\*\/)?;/g)) {
    map.set(name, value);
  }
  return map;
}

describe('admin page design tokens', () => {
  const web = declarations(read('web/styles/partials/variables.css'), ':root');
  const admin = declarations(read('backend/src/admin-ui/admin.css'), ':root');

  it('declares tokens', () => {
    expect(web.size).toBeGreaterThan(50);
    expect(admin.size).toBeGreaterThan(20);
  });

  it.each([...admin.entries()])('%s matches web/styles/partials/variables.css', (name, value) => {
    expect(web.get(name)).toBe(value);
  });

  it('never uses inline styles or scripts in the page shell', () => {
    const html = read('backend/src/admin-ui/index.html');
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)/);
    expect(html).not.toMatch(/\son[a-z]+=/);
  });
});
