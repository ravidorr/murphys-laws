import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('error boundary banner', () => {
  it('does not render the refresh URL with innerHTML', () => {
    const mainSource = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');

    expect(mainSource).not.toMatch(/\bbanner\.innerHTML\s*=/);
  });
});
