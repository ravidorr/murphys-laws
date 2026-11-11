import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The config is read as text: the tests run in a DOM environment, where esbuild cannot load vite.config.ts,
// and the Sentry plugin is only built when the upload environment variables are set.
const config = readFileSync(resolve(__dirname, '..', 'vite.config.ts'), 'utf8');

describe('production source maps', () => {
  // The Sentry upload deletes dist/**/*.map, so a bundle that still ends in //# sourceMappingURL=...
  // sends the crawlers and scrapers that follow the comment to a 404.
  it('emits hidden source maps, which leave out the sourceMappingURL comment', () => {
    expect(config).toMatch(/^\s*sourcemap:\s*['"]hidden['"],/m);
    expect(config).not.toMatch(/^\s*sourcemap:\s*true/m);
  });

  it('still deletes the maps from dist after the Sentry upload', () => {
    expect(config).toMatch(/filesToDeleteAfterUpload:\s*\[\s*['"]\.\/dist\/\*\*\/\*\.map['"]\s*\]/);
  });
});
