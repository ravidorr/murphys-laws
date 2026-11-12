import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPRESSIBLE_EXTENSIONS } from '../scripts/precompress-assets.ts';

const root = resolve(__dirname, '..', '..');
const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
const apexStart = conf.indexOf('\nserver {');
const apex = conf.slice(apexStart, conf.indexOf('\n}\n', apexStart) + 3);
const serverBlocks = conf.split(/^server \{$/m).slice(1);

// The block of a nested location, found by its opening line, up to its closing brace on its own line (a regex
// quantifier such as {8} holds a brace too).
function locationBody(opening: string): string {
  const start = apex.indexOf(opening);
  expect(start, `${opening} is missing`).toBeGreaterThan(-1);
  return apex.slice(start, apex.indexOf('\n        }', start));
}

describe('nginx compression', () => {
  const gzipTypes = (/^\s*gzip_types\s+([^;]+);/m.exec(apex)?.[1] ?? '').trim().split(/\s+/);

  it('turns gzip on for the site with the response headers a cache needs', () => {
    expect(apex).toMatch(/^\s*gzip on;$/m);
    expect(apex).toMatch(/^\s*gzip_vary on;$/m);
    expect(apex).toMatch(/^\s*gzip_proxied any;$/m);
    expect(apex).toMatch(/^\s*gzip_comp_level 5;$/m);
    expect(apex).toMatch(/^\s*gzip_min_length 256;$/m);
  });

  it.each([
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'application/manifest+json',
    'application/xml',
    'image/svg+xml',
    'text/plain',
    'text/xml',
  ])('compresses %s (the default gzip_types only covers text/html)', (type) => {
    expect(gzipTypes).toContain(type);
  });

  it('never turns compression off in a location', () => {
    expect(apex).not.toMatch(/^\s*gzip(_static)? off;/m);
  });

  it('never lists text/html, which nginx always compresses (listing it only draws a warning)', () => {
    expect(gzipTypes).not.toContain('text/html');
  });

  it('does not enable brotli until the module is installed on the server', () => {
    // An unknown directive fails nginx -t in the deploy step and leaves a broken file in sites-available.
    expect(conf).not.toMatch(/^\s*brotli\w*\s/m);
  });
});

describe('nginx hashed asset caching', () => {
  // The pattern is quoted: an unquoted { ends the location line for nginx, and nginx -t then reports an unknown directive.
  const opening = 'location ~* "^/assets/';
  const hashed = locationBody(opening);
  const pattern = new RegExp(/location ~\* "([^"]+)" \{/.exec(hashed)?.[1] ?? '(?!)', 'i');

  it('serves precompressed files and sets one immutable Cache-Control header', () => {
    expect(hashed).toMatch(/^\s*gzip_static on;$/m);
    expect(hashed.match(/add_header Cache-Control /g)).toHaveLength(1);
    expect(hashed).toContain('add_header Cache-Control "public, max-age=31536000, immutable";');
    // expires would add a second Cache-Control header next to add_header.
    expect(hashed).not.toContain('expires');
  });

  it.each([
    '/assets/index-DZClfRb6.js',
    '/assets/style-BhqpAbOy.css',
    '/assets/index-legacy-Cklsc8H4.js',
    '/assets/_commonjsHelpers-Cpj98o6Y.js',
    '/assets/jspdf.es.min-Cr4cOggc.js',
    '/assets/index-BS_0-z5K.js',
    '/assets/tex-chtml-BxSgg8oi.js',
  ])('treats %s as hashed', (uri) => {
    expect(pattern.test(uri)).toBe(true);
  });

  it.each([
    '/sw.js',
    '/offline.js',
    '/workbox-50f48223.js',
    '/styles/fallback-pages.css',
    '/assets/main.js',
    '/assets/index-DZClfRb6.js.map',
    '/img/logo-ABCDEFGH.png',
  ])('keeps %s out of the immutable rule', (uri) => {
    expect(pattern.test(uri)).toBe(false);
  });

  it('serves a precompressed copy for every extension the build precompresses', () => {
    for (const extension of COMPRESSIBLE_EXTENSIONS) {
      expect(pattern.test(`/assets/index-DZClfRb6${extension}`), extension).toBe(true);
    }
  });

  it('relies on Vite keeping its 8-character content hash in the file names', () => {
    // A [hash:12] or a custom file-name pattern would silently turn off immutable caching and gzip_static.
    const viteConfig = readFileSync(resolve(root, 'web', 'vite.config.ts'), 'utf8');
    expect(viteConfig).not.toMatch(/assetFileNames|chunkFileNames|entryFileNames/);
  });

  it('comes before the generic static-file rule so that it wins', () => {
    const generic = apex.indexOf('location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$');
    expect(generic).toBeGreaterThan(-1);
    expect(apex.indexOf(opening)).toBeLessThan(generic);
  });

  it('leaves the other static files without immutable, since their names do not change', () => {
    const generic = locationBody('location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$');
    expect(generic).not.toContain('immutable');
  });

  it('does not set add_header above the nested locations, which would be lost there', () => {
    const beforeNested = apex.slice(0, apex.indexOf('location / {'));
    expect(beforeNested).not.toMatch(/^\s*add_header\s/m);
  });
});

describe('nginx HTTP/2', () => {
  const tlsBlocks = serverBlocks.filter((block) => /^\s*listen 443 /m.test(block));

  it('offers HTTP/2 on both TLS server blocks', () => {
    expect(tlsBlocks).toHaveLength(2);
    for (const block of tlsBlocks) {
      // nginx 1.24 (Ubuntu 24.04) only knows the listen parameter, not the http2 directive of 1.25.1.
      expect(block).toMatch(/^\s*listen 443 ssl http2;/m);
    }
    expect(conf).not.toMatch(/^\s*http2 on;/m);
  });

  it('leaves the plain HTTP server block alone', () => {
    expect(serverBlocks.filter((block) => /^\s*listen 80;/m.test(block))).toHaveLength(1);
  });
});

describe('nginx timed access log', () => {
  it('defines a timed format with the request and upstream times', () => {
    const format = /log_format timed ([^;]+);/.exec(conf)?.[1] ?? '';
    expect(format).toContain('rt=$request_time');
    expect(format).toContain('urt="$upstream_response_time"');
    expect(format).toContain('uct="$upstream_connect_time"');
    expect(format).toContain('proto=$server_protocol');
  });

  it('writes it next to the combined log in every server block, without changing the combined log', () => {
    expect(conf.match(/access_log \/var\/log\/nginx\/access_timed\.log timed if=\$log_normal;/g)).toHaveLength(3);
    // log_format is only valid in the http context, which is above the first server block of this file.
    expect(conf.indexOf('log_format timed')).toBeGreaterThan(-1);
    expect(conf.indexOf('log_format timed')).toBeLessThan(conf.indexOf('\nserver {'));
    expect(conf).not.toMatch(/log_format combined/);
  });
});

describe('web build', () => {
  it('precompresses after the service worker has been generated', () => {
    const scripts = (
      JSON.parse(readFileSync(resolve(root, 'web', 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    const build = scripts.build ?? '';

    expect(build.indexOf('generate-service-worker.ts')).toBeGreaterThan(-1);
    expect(build.indexOf('precompress-assets.ts')).toBeGreaterThan(build.indexOf('generate-service-worker.ts'));
  });
});
