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

// nginx header names are case-insensitive and may be quoted, so a header written as `Add_Header "cache-control"` still
// counts. Both patterns are global: use them with match/matchAll only.
const CACHE_CONTROL_DIRECTIVE = /^\s*add_header\s+"?cache-control"?\s/gim;
const CACHE_CONTROL_VALUE = /^\s*add_header\s+"?cache-control"?\s+"([^"]+)"/gim;

// The server block with every `location` block (and what is nested in it) cut out, so only the directives of the
// server level are left. Braces inside quotes (a regex quantifier such as {8}) and comment lines do not count.
function serverLevelDirectives(block: string): string {
  const source = block.replace(/^\s*#.*$/gm, '');
  let output = '';
  let statement = '';
  let quoted = false;
  const stack: boolean[] = [];
  for (const char of source) {
    if (char === '"') {
      quoted = !quoted;
    }
    if (!quoted && char === '{') {
      const isLocation = /^\s*location\s/.test(statement);
      if (isLocation && !stack.includes(true)) {
        // Cut the `location ...` line itself, which was already copied while it was being read.
        output = output.slice(0, output.length - statement.length);
      }
      stack.push(isLocation);
      statement = '';
      output += stack.includes(true) ? '' : char;
    } else if (!quoted && char === '}') {
      const inLocation = stack.includes(true);
      stack.pop();
      statement = '';
      output += inLocation ? '' : char;
    } else {
      if (!quoted && char === ';') {
        statement = '';
      } else {
        statement += char;
      }
      output += stack.includes(true) ? '' : char;
    }
  }
  expect(stack, 'the braces of the server block are balanced').toEqual([]);
  return output;
}

describe('nginx compression', () => {
  const gzipTypes = (/^\s*gzip_types\s+([^;]+);/m.exec(apex)?.[1] ?? '').trim().split(/\s+/);

  it('turns gzip on for the site with the response headers a cache needs', () => {
    expect(apex).toMatch(/^\s*gzip on;$/m);
    expect(apex).toMatch(/^\s*gzip_vary on;$/m);
    // Vary: Accept-Encoding of the .br and .gz responses comes from it, so it must be inherited by every location.
    expect(serverLevelDirectives(apex)).toMatch(/^\s*gzip_vary on;$/m);
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

  it('uses exactly one brotli directive, brotli_static on, and enables no dynamic brotli', () => {
    // Dynamic compression (brotli on, brotli_types, brotli_comp_level) stays out: the precompressed .br files cover
    // the hashed assets and gzip the rest. Comment lines are dropped so the prose may mention brotli; a directive
    // anywhere on a line counts. The module that provides brotli_static is installed on the server before this file
    // is deployed (shared/docs/DEPLOYMENT.md).
    const source = conf.replace(/^\s*#.*$/gm, '');
    expect(source.match(/\bbrotli\w*\s[^;]*;/g)).toEqual(['brotli_static on;']);
  });

  it('has the disaster-recovery runbook install the nginx module that provides brotli_static', () => {
    // Without the package nginx -t fails with: unknown directive "brotli_static".
    const runbook = readFileSync(resolve(root, 'shared', 'docs', 'DISASTER-RECOVERY.md'), 'utf8');
    expect(runbook).toMatch(/^\s*apt install -y [^\n]*\blibnginx-mod-http-brotli-static\b/m);
  });
});

// The static-file locations nested in `location /`, in file order. nginx tests the regex locations of one block in
// that order and uses the first match, so the order of this list is the precedence. Either quoted or a single word.
// The operator decides the case rule: ~* ignores case, ~ does not (an exact = or prefix ^~ location is not read at all,
// which a test below guards against).
const staticLocations = [
  ...apex.matchAll(/^ {8}location (~\*?) (?:"([^"]+)"|(\S+)) \{\n([\s\S]*?)\n {8}\}$/gm),
].map((match) => ({
  operator: match[1] ?? '',
  pattern: new RegExp(match[2] ?? match[3] ?? '(?!)', match[1] === '~*' ? 'i' : ''),
  body: match[4] ?? '',
}));

type CacheClass = 'immutable' | 'revalidate' | 'one-year' | 'unset';

// What nginx sends for a file served through `location /`: the nested location a URI lands in decides it.
function cacheFor(uri: string): { cacheClass: CacheClass; headers: string[]; expires: string | null } {
  // nginx matches a location against the path without its query string.
  const path = uri.split('?')[0] ?? uri;
  const location = staticLocations.find(({ pattern }) => pattern.test(path));
  const headers = [...(location?.body.matchAll(CACHE_CONTROL_VALUE) ?? [])].map((m) => m[1] ?? '');
  const expires = /^\s*expires\s+([^;]+);/m.exec(location?.body ?? '')?.[1]?.trim() ?? null;
  if (headers.some((header) => header.includes('immutable'))) {
    return { cacheClass: 'immutable', headers, expires };
  }
  if (headers.includes('no-cache')) {
    return { cacheClass: 'revalidate', headers, expires };
  }
  return { cacheClass: expires === null ? 'unset' : 'one-year', headers, expires };
}

describe('nginx hashed asset caching', () => {
  // The pattern is quoted: an unquoted { ends the location line for nginx, and nginx -t then reports an unknown directive.
  const opening = 'location ~* "^/assets/';
  const hashed = locationBody(opening);
  const pattern = new RegExp(/location ~\* "([^"]+)" \{/.exec(hashed)?.[1] ?? '(?!)', 'i');

  it('serves precompressed files and sets one immutable Cache-Control header', () => {
    expect(hashed).toMatch(/^\s*gzip_static on;$/m);
    expect(hashed).toMatch(/^\s*brotli_static on;$/m);
    expect(hashed.match(CACHE_CONTROL_DIRECTIVE)).toHaveLength(1);
    expect(hashed).toContain('add_header Cache-Control "public, max-age=31536000, immutable";');
    // expires would add a second Cache-Control header next to add_header.
    expect(hashed).not.toMatch(/^\s*(expires|add_header\s+"?expires"?)\b/im);
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
    '/assets/index-DZClfRb6.js.br',
    '/assets/index-DZClfRb6.js.gz',
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
    // A [hash:12] or a custom file-name pattern would silently turn off immutable caching, gzip_static and
    // brotli_static.
    const viteConfig = readFileSync(resolve(root, 'web', 'vite.config.ts'), 'utf8');
    expect(viteConfig).not.toMatch(/assetFileNames|chunkFileNames|entryFileNames/);
  });

  it('comes before every other static-file rule so that it wins', () => {
    expect(staticLocations.length).toBeGreaterThan(1);
    expect(staticLocations[0]?.body).toContain('immutable');
  });

  it('leaves the other static files without immutable, since they are not content-hashed', () => {
    for (const location of staticLocations.slice(1)) {
      expect(location.body, location.pattern.source).not.toContain('immutable');
    }
  });

  it('sets no add_header at the server level, which every location that sets its own would silently drop', () => {
    const serverLevel = serverLevelDirectives(apex);
    // The stripping kept the server's own directives and cut every location out.
    expect(serverLevel).toMatch(/^\s*gzip on;$/m);
    expect(serverLevel).not.toContain('Cache-Control');
    expect(serverLevel).not.toMatch(/^\s*location\s/m);
    expect(serverLevel).not.toMatch(/^\s*add_header\s/im);
  });
});

describe('nginx caching of the files that are not hashed', () => {
  // File names from web/dist (the build in web/package.json) and the paths the pages link to, plus upper-case
  // spellings. The lists below also hold made-up probe names (/some-future-script.js, /assets/main.js, /some/logo.svg,
  // /assets/logo.png).
  it.each([
    '/sw.js',
    '/offline.js',
    '/styles/embed.css',
    '/styles/fallback-pages.css',
    '/styles/subscription-pages.css',
    '/styles/partials/variables.css',
    '/assets/main.js',
    '/some-future-script.js',
    '/SW.JS',
    '/Styles/Embed.CSS',
    '/Manifest.WebManifest',
    '/sw.js?v=2',
    '/styles/embed.css?x=1',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/image-sitemap.xml',
  ])('makes the browser revalidate %s with one no-cache header and no expires', (uri) => {
    expect(cacheFor(uri)).toEqual({ cacheClass: 'revalidate', headers: ['no-cache'], expires: null });
  });

  it.each([
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
    '/social/home.png',
    '/social/sods-calculator.png',
    '/img/pvtmurphy.gif',
    '/img/sledtrk.jpg',
    '/some/logo.svg',
    '/assets/logo.png',
    '/FAVICON.ICO',
    '/img/SledTrk.JPG',
  ])('keeps the one-year lifetime of the image %s', (uri) => {
    expect(cacheFor(uri)).toEqual({ cacheClass: 'one-year', headers: ['public, no-transform'], expires: '1y' });
  });

  it.each([
    '/assets/index-DZClfRb6.js',
    '/assets/style-BhqpAbOy.css',
    '/assets/logo-AbCdEfGh.png',
    '/assets/INDEX-DZClfRb6.JS',
  ])(
    'still caches the hashed %s for good',
    (uri) => {
      expect(cacheFor(uri).cacheClass).toBe('immutable');
    },
  );

  it.each([
    '/',
    '/about',
    '/offline.html',
    '/404.html',
    '/ads.txt',
    '/llms.txt',
    '/social/home.webp',
    '/assets/index-DZClfRb6.js.map',
    '/assets/font.woff2',
  ])('adds no cache rule to %s', (uri) => {
    expect(cacheFor(uri)).toEqual({ cacheClass: 'unset', headers: [], expires: null });
  });

  it('is not blind to a nested location of another kind, which would take precedence in nginx', () => {
    // The parser reads `location ~* pattern` and `location ~ pattern` (in file order, like nginx does for regexes); an
    // exact (=) or prefix (^~) location nested in `location /` would win over these and be invisible to cacheFor,
    // so there must be none.
    const nestedOpenings = apex.match(/^ {8}location /gm) ?? [];
    expect(nestedOpenings).toHaveLength(staticLocations.length);
  });

  it('reads every static-file location as a case-insensitive ~* location, as nginx does', () => {
    // The parser takes the case rule from the operator, so a plain ~ (case-sensitive) location is modelled as such
    // and fails here instead of being treated as case-insensitive without anyone noticing.
    for (const { operator, pattern } of staticLocations) {
      expect(operator, pattern.source).toBe('~*');
      expect(pattern.flags, pattern.source).toBe('i');
    }
  });

  it('sends no Expires header from the no-cache locations, which would sit next to Cache-Control', () => {
    const revalidating = staticLocations.filter(({ body }) => body.includes('no-cache'));
    expect(revalidating).toHaveLength(2);
    for (const { body, pattern } of revalidating) {
      expect(body, pattern.source).not.toMatch(/^\s*(expires|add_header\s+"?expires"?)\b/im);
    }
  });

  it('has exactly one add_header Cache-Control in every static-file location', () => {
    for (const { body, pattern } of staticLocations) {
      expect(body.match(CACHE_CONTROL_DIRECTIVE), pattern.source).toHaveLength(1);
    }
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
