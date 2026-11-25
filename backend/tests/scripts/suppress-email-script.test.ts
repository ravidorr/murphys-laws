import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BACKEND = resolve(import.meta.dirname, '..', '..');

describe('npm run email:suppress', () => {
  it('is defined and points at a script that exists, because the post-deploy cleanup depends on it', () => {
    const { scripts } = JSON.parse(readFileSync(resolve(BACKEND, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(scripts['email:suppress']).toBe('tsx scripts/suppress-email.ts');
    expect(existsSync(resolve(BACKEND, 'scripts/suppress-email.ts'))).toBe(true);
  });
});
