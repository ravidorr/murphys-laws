import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  renderFallbackTokens,
  runGenerateFallbackTokens,
} from '../scripts/generate-fallback-tokens.ts';

const webRoot = path.resolve(__dirname, '..');

function readWebFile(relativePath: string): string {
  return fs.readFileSync(path.join(webRoot, relativePath), 'utf8');
}

describe('static fallback page assets', () => {
  it.each(['public/404.html', 'public/offline.html'])(
    'references only shipped fallback styles in %s',
    (relativePath) => {
      const html = readWebFile(relativePath);

      expect(html).toContain(
        '<link rel="stylesheet" href="/styles/partials/variables.css">',
      );
      expect(html).toContain(
        '<link rel="stylesheet" href="/styles/fallback-pages.css">',
      );
      expect(html).not.toContain('/styles/site.css');
    },
  );

  it('generates the fallback token artifact from authoritative variables', () => {
    const writes = new Map<string, string>();
    const makeDirectory = vi.fn();
    const code = runGenerateFallbackTokens({
      sourcePath: '/web/styles/partials/variables.css',
      outputPath: '/web/dist/styles/partials/variables.css',
      exists: () => true,
      read: () => ':root { --bg: #fff; }\n',
      makeDirectory,
      write: (file, contents) => writes.set(file, contents),
      logger: {
        log: () => undefined,
        error: () => undefined,
      },
    });

    expect(code).toBe(0);
    expect(makeDirectory).toHaveBeenCalledWith('/web/dist/styles/partials');
    expect(writes.get('/web/dist/styles/partials/variables.css')).toBe(
      renderFallbackTokens(':root { --bg: #fff; }\n'),
    );
  });

  it('runs fallback token generation before service-worker generation', () => {
    const scripts = (
      JSON.parse(readWebFile('package.json')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    const build = scripts.build ?? '';

    expect(build.indexOf('generate-fallback-tokens.ts')).toBeGreaterThan(-1);
    expect(build.indexOf('generate-service-worker.ts')).toBeGreaterThan(
      build.indexOf('generate-fallback-tokens.ts'),
    );
  });
});
