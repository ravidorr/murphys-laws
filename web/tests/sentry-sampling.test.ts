import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// main.ts is the entry point and boots the whole app, so a unit test cannot import it. Its Sentry rate is
// checked in the source text, like error-boundary-security.test.ts does for the banner code. When the rate is
// lowered again after the 2026-11-19 performance report, update the expected value here.
const mainSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main.ts'), 'utf8');

describe('web Sentry performance sampling', () => {
  it('samples every transaction for the performance measurement window', () => {
    expect(mainSource).toMatch(/^\s*tracesSampleRate:\s*1(\.0)?,\s*$/m);
  });
});
