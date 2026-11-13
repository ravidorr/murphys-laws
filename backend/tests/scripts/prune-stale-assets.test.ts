import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Passes every node:fs call through, unless a test installs an override to force a failure.
const overrides = vi.hoisted(() => ({
  readFileSync: undefined as undefined | ((file: string) => unknown),
  readdirSync: undefined as undefined | ((directory: string) => unknown),
  lstatSync: undefined as undefined | ((file: string) => unknown),
  unlinkSync: undefined as undefined | ((file: string) => unknown),
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) =>
      overrides.readFileSync ? overrides.readFileSync(String(args[0])) : actual.readFileSync(...args),
    readdirSync: (...args: Parameters<typeof actual.readdirSync>) =>
      overrides.readdirSync ? overrides.readdirSync(String(args[0])) : (actual.readdirSync as (...a: unknown[]) => unknown)(...args),
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) =>
      overrides.unlinkSync ? overrides.unlinkSync(String(args[0])) : actual.unlinkSync(...args),
    lstatSync: (...args: Parameters<typeof actual.lstatSync>) =>
      overrides.lstatSync ? overrides.lstatSync(String(args[0])) : (actual.lstatSync as (...a: unknown[]) => unknown)(...args),
  };
});

const {
  DEFAULT_MAX_AGE_DAYS,
  MAX_DELETE_FRACTION,
  MIN_KEPT_FILES,
  entryAssets,
  namesIn,
  planDirectory,
  isEntryPoint,
  requestedNames,
  run,
  runCli,
} = await import('../../scripts/prune-stale-assets.mjs');

// The real lstat and unlink, for the overrides that fake one file.
const { lstatSync: realLstat, unlinkSync: realUnlink, readFileSync: realRead } = await vi.importActual<typeof import('node:fs')>('node:fs');

const boxes: string[] = [];
afterEach(() => {
  overrides.readFileSync = undefined;
  overrides.readdirSync = undefined;
  overrides.lstatSync = undefined;
  overrides.unlinkSync = undefined;
  for (const box of boxes.splice(0)) rmSync(box, { recursive: true, force: true });
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const OLD = new Date(NOW - 90 * DAY);
const RECENT = new Date(NOW - 5 * DAY);

function write(file: string, contents: string, modified: Date): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
  utimesSync(file, modified, modified);
}

/** A dist directory shaped like a deployed build, with old releases piled up in assets/. */
function fakeDist(options: { siblings?: boolean } = {}): string {
  const dist = mkdtempSync(path.join(tmpdir(), 'prune-assets-'));
  boxes.push(dist);
  const assets = path.join(dist, 'assets');
  const sw = (name: string, contents: string, modified = OLD) => write(path.join(assets, name), contents, modified);

  // The current build, all old on disk (a rebuild would have touched them, but the rule must not depend on it).
  write(
    path.join(dist, 'index.html'),
    '<!doctype html><link rel="stylesheet" href="/assets/style-CUR1.css"><script type="module" src="/assets/index-CUR1.js"></script>',
    OLD,
  );
  sw('index-CUR1.js', 'import"./chunk-DEP1.js";const m=["assets/lazy-DYN1.js"];', OLD);
  sw('chunk-DEP1.js', 'export default 1; import("./deep-DEP2.js")', OLD);
  sw('deep-DEP2.js', 'export default 2', OLD);
  sw('lazy-DYN1.js', 'export default 3', OLD);
  sw('style-CUR1.css', '@font-face{src:url(./font-FNT1.woff2)} .a{background:url(img-BG1.svg)}', OLD);
  sw('font-FNT1.woff2', 'font', OLD);
  sw('img-BG1.svg', '<svg/>', OLD);
  // Named only by a page, the service worker and the manifest.
  write(path.join(dist, 'about/index.html'), '<script src="/assets/page-ABT1.js"></script>', OLD);
  sw('page-ABT1.js', 'export default 4', OLD);
  write(path.join(dist, 'sw.js'), 'precache([{url:"/assets/pre-SW01.js"}])', OLD);
  sw('pre-SW01.js', 'export default 5', OLD);
  // Not text, so it is not scanned even though its bytes name a stale file.
  write(path.join(dist, 'favicon.png'), 'old-style-OLD3.css', OLD);
  write(path.join(dist, 'manifest.webmanifest'), '{"icons":[{"src":"/assets/icon-MAN1.png"}]}', OLD);
  sw('icon-MAN1.png', 'png', OLD);

  // Kept because they are recent, even though nothing names them.
  sw('recent-NEW1.js', 'export default 6', RECENT);
  sw('recent-NEW1.js.map', '{}', RECENT);

  // Stale: old, and named by nothing that is kept.
  sw('old-OLD1.js', 'import"./old-dep-OLD2.js"', OLD);
  sw('old-dep-OLD2.js', 'export default 7', OLD);
  sw('old-OLD1.js.map', '{"version":3}', OLD);
  sw('old-style-OLD3.css', '.old{}', OLD);

  if (options.siblings) {
    for (const name of ['index-CUR1.js', 'style-CUR1.css', 'old-OLD1.js']) {
      sw(`${name}.gz`, 'gz', OLD);
      sw(`${name}.br`, 'br', OLD);
    }
    sw('index-CUR1.js.map', '{}', OLD);
  }
  return dist;
}

const listing = (dist: string) => readdirSync(path.join(dist, 'assets')).sort();

describe('namesIn and entryAssets', () => {
  it('finds only names that exist, in any quoting', () => {
    const names = new Set(['a-1.js', 'b-2.css', 'c-3.woff2']);
    const found = namesIn('import"./a-1.js";x("assets/b-2.css");url(c-3.woff2) other-4.js', names);

    expect([...found].sort()).toEqual(['a-1.js', 'b-2.css', 'c-3.woff2']);
    expect(namesIn('nothing here', names).size).toBe(0);
  });

  it('reads the scripts and stylesheets of the entry page', () => {
    const html =
      '<link rel="modulepreload" href="/assets/vendor-V1.js"><link rel="stylesheet" href="/assets/style-S1.css?x=1">' +
      '<script type="module" crossorigin src="/assets/index-I1.js"></script><script src="/other/x.js"></script>';

    expect(entryAssets(html)).toEqual({ scripts: ['index-I1.js'], styles: ['vendor-V1.js', 'style-S1.css'] });
    expect(entryAssets('<p>no assets</p>')).toEqual({ scripts: [], styles: [] });
  });
});

describe('planDirectory', () => {
  it('keeps everything the current build reaches and everything recent, and plans the rest for deletion', () => {
    const plan = planDirectory(fakeDist(), { now: NOW });

    expect(plan.candidates).toEqual(['old-OLD1.js', 'old-OLD1.js.map', 'old-dep-OLD2.js', 'old-style-OLD3.css']);
    expect(plan.total).toBe(listing(plan.dist).length);
    expect(plan.kept).toBe(plan.total - 4);
    // The entry page, the other page, the service worker and the manifest name five files directly.
    expect(plan.referenced).toBe(5);
    expect(plan.candidateBytes).toBeGreaterThan(0);
    expect(plan.totalBytes).toBeGreaterThan(plan.candidateBytes);
  });

  it('keeps the .gz, .br and .map siblings of kept files and deletes those of stale files with them', () => {
    const plan = planDirectory(fakeDist({ siblings: true }), { now: NOW });

    expect(plan.candidates).toEqual([
      'old-OLD1.js',
      'old-OLD1.js.br',
      'old-OLD1.js.gz',
      'old-OLD1.js.map',
      'old-dep-OLD2.js',
      'old-style-OLD3.css',
    ]);
  });

  it('works the same without any precompressed siblings', () => {
    expect(planDirectory(fakeDist(), { now: NOW }).candidates).toHaveLength(4);
  });

  it('keeps more when the age limit is longer', () => {
    const plan = planDirectory(fakeDist(), { now: NOW, maxAgeDays: 120 });

    expect(plan.candidates).toEqual([]);
  });

  it('uses the defaults: the real clock and a 30-day limit', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      expect(DEFAULT_MAX_AGE_DAYS).toBe(30);
      expect(planDirectory(fakeDist()).candidates).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws the age line exactly at the limit', () => {
    const dist = fakeDist();
    for (const [name, modified] of [
      ['edge-AGE1.js', new Date(NOW - 30 * DAY)],
      ['edge-AGE2.js', new Date(NOW - 30 * DAY - 1)],
      ['edge-AGE3.js', new Date(NOW + DAY)],
    ] as const) {
      write(path.join(dist, 'assets', name), 'x', modified);
    }

    expect(planDirectory(dist, { now: NOW }).candidates).toEqual([
      'edge-AGE2.js',
      'old-OLD1.js',
      'old-OLD1.js.map',
      'old-dep-OLD2.js',
      'old-style-OLD3.css',
    ]);
  });

  it.each([
    ['json', 'data-DATA1.json'],
    ['js', 'a-JSJS1.js'],
    ['mjs', 'm-MJS1.mjs'],
    ['css', 'c-CSS01.css'],
    ['woff2', 'f-WOFF2.woff2'],
    ['woff', 'f-WOFF1.woff'],
    ['ttf', 'f-TTF01.ttf'],
    ['wasm', 'w-WASM1.wasm'],
    ['jpeg', 'p-JPEG1.jpeg'],
    ['webp', 'p-WEBP1.webp'],
  ])('finds a %s file named by a kept script', (_extension, name) => {
    const dist = fakeDist();
    write(path.join(dist, 'assets', name), 'x', OLD);
    write(path.join(dist, 'assets/index-CUR1.js'), `import"./chunk-DEP1.js";const m=["assets/${name}"];`, OLD);

    expect(planDirectory(dist, { now: NOW }).candidates).not.toContain(name);
  });

  it('keeps every same-named file in different directories under assets/', () => {
    const dist = fakeDist();
    write(path.join(dist, 'assets/sub/old-style-OLD3.css'), '.x{}', OLD);
    expect(planDirectory(dist, { now: NOW }).candidates).toContain('sub/old-style-OLD3.css');

    write(path.join(dist, 'index.html'), '<script type="module" src="/assets/index-CUR1.js"></script><link href="/assets/old-style-OLD3.css">', OLD);
    const referenced = planDirectory(dist, { now: NOW }).candidates;
    expect(referenced).not.toContain('old-style-OLD3.css');
    expect(referenced).not.toContain('sub/old-style-OLD3.css');

    write(path.join(dist, 'index.html'), '<script type="module" src="/assets/index-CUR1.js"></script>', OLD);
    const requested = planDirectory(dist, { now: NOW, requested: new Set(['old-style-OLD3.css']) }).candidates;
    expect(requested).not.toContain('sub/old-style-OLD3.css');
  });

  it('keeps what a recent file imports through a chain, and survives an import cycle', () => {
    const dist = fakeDist();
    write(path.join(dist, 'assets/recent-NEW2.js'), 'import"./cyc-CYC1.js"', RECENT);
    write(path.join(dist, 'assets/cyc-CYC1.js'), 'import"./cyc-CYC2.js"', OLD);
    write(path.join(dist, 'assets/cyc-CYC2.js'), 'import"./cyc-CYC1.js"', OLD);

    const candidates = planDirectory(dist, { now: NOW }).candidates;

    expect(candidates).not.toContain('cyc-CYC1.js');
    expect(candidates).not.toContain('cyc-CYC2.js');
  });

  it('reads css, json and txt files outside assets/ for names, at any depth', () => {
    const dist = fakeDist();
    write(path.join(dist, 'styles/site.css'), '.a{background:url(/assets/old-style-OLD3.css)}', OLD);
    write(path.join(dist, 'deep/er/data.json'), '{"x":"old-dep-OLD2.js"}', OLD);
    write(path.join(dist, 'robots.txt'), 'old-OLD1.js.map', OLD);

    const candidates = planDirectory(dist, { now: NOW }).candidates;

    expect(candidates).toEqual(['old-OLD1.js']);
  });

  it('does not read a named pipe or a link to a directory that carries the name of a text file', () => {
    const dist = fakeDist();
    mkdirSync(path.join(dist, 'real-dir'));
    symlinkSync(path.join(dist, 'real-dir'), path.join(dist, 'dir-link.html'));
    expect(spawnSync('mkfifo', [path.join(dist, 'pipe.txt')]).status).toBe(0);

    expect(planDirectory(dist, { now: NOW }).candidates).toEqual(['old-OLD1.js', 'old-OLD1.js.map', 'old-dep-OLD2.js', 'old-style-OLD3.css']);
  });

  it('aborts when a kept script cannot be read while the names are traced', () => {
    const dist = fakeDist();
    const before = listing(dist);
    overrides.readFileSync = (file) => {
      if (file.endsWith('chunk-DEP1.js')) throw Object.assign(new Error('denied'), { code: 'EACCES' });
      return realRead(file, 'utf8');
    };
    const io = { out: [] as string[], err: [] as string[] };

    expect(run([dist], { log: (l) => io.out.push(l), error: (l) => io.err.push(l), now: NOW })).toBe(1);
    expect(io.err.join('\n')).toMatch(/nothing deleted: cannot read .*chunk-DEP1\.js: EACCES/);
    expect(listing(dist)).toEqual(before);
  });

  it('aborts a dry run too when a safety check fails', () => {
    const dist = fakeDist();
    rmSync(path.join(dist, 'index.html'));
    const io = { out: [] as string[], err: [] as string[] };

    expect(run(['--dry-run', dist], { log: (l) => io.out.push(l), error: (l) => io.err.push(l), now: NOW })).toBe(1);
    expect(io.err.join('\n')).toMatch(/nothing deleted/);
    expect(io.out).toEqual([]);
  });

  it('leaves links and non-regular files out of the plan', () => {
    const dist = fakeDist();
    symlinkSync(path.join(dist, 'assets/old-OLD1.js'), path.join(dist, 'assets/link-LNK1.js'));
    mkdirSync(path.join(dist, 'assets/empty-dir'));

    const plan = planDirectory(dist, { now: NOW });

    expect(plan.candidates).not.toContain('link-LNK1.js');
    expect(plan.total).toBe(listing(dist).length - 2);
  });

  it('does not follow a link to a directory, and never deletes through it', () => {
    const dist = fakeDist();
    const outside = mkdtempSync(path.join(tmpdir(), 'prune-outside-'));
    boxes.push(outside);
    write(path.join(outside, 'precious-OLD9.js'), 'x', OLD);
    symlinkSync(outside, path.join(dist, 'assets/linked-dir'));

    expect(planDirectory(dist, { now: NOW }).candidates.join()).not.toContain('precious');
    expect(run([dist], { log: () => undefined, error: () => undefined, now: NOW })).toBe(0);
    expect(readdirSync(outside)).toEqual(['precious-OLD9.js']);
  });

  it('aborts when assets/ or index.html is a link', () => {
    const dist = fakeDist();
    const real = path.join(dist, 'assets-real');
    rmSync(real, { recursive: true, force: true });
    mkdirSync(real);
    rmSync(path.join(dist, 'assets'), { recursive: true });
    symlinkSync(real, path.join(dist, 'assets'));
    expect(() => planDirectory(dist, { now: NOW })).toThrow(/assets is not a directory/);

    const other = fakeDist();
    const html = path.join(other, 'index.html');
    writeFileSync(path.join(other, 'real.html'), '<script src="/assets/index-CUR1.js"></script>');
    rmSync(html);
    symlinkSync(path.join(other, 'real.html'), html);
    expect(() => planDirectory(other, { now: NOW })).toThrow(/index\.html is not a file/);
  });

  describe('aborts without a plan', () => {
    it('when index.html is missing', () => {
      const dist = fakeDist();
      rmSync(path.join(dist, 'index.html'));

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot stat .*index\.html/);
    });

    it('when index.html is not a file', () => {
      const dist = fakeDist();
      rmSync(path.join(dist, 'index.html'));
      mkdirSync(path.join(dist, 'index.html'));

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/index\.html is not a file/);
    });

    it('when assets is not a directory', () => {
      const dist = fakeDist();
      rmSync(path.join(dist, 'assets'), { recursive: true });
      writeFileSync(path.join(dist, 'assets'), 'not a directory');

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/assets is not a directory/);
    });

    it('when index.html names no entry script', () => {
      const dist = fakeDist();
      write(path.join(dist, 'index.html'), '<p>empty shell</p>', OLD);

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/names no entry script/);
    });

    it('when the entry script is missing', () => {
      const dist = fakeDist();
      rmSync(path.join(dist, 'assets/index-CUR1.js'));

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/assets\/index-CUR1\.js, which is missing/);
    });

    it('when the entry stylesheet is missing', () => {
      const dist = fakeDist();
      rmSync(path.join(dist, 'assets/style-CUR1.css'));

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/assets\/style-CUR1\.css, which is missing/);
    });

    it('when a file that can name assets cannot be read', () => {
      const dist = fakeDist();
      symlinkSync(path.join(dist, 'nowhere'), path.join(dist, 'broken.html'));

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot read .*broken\.html: ENOENT/);
    });

    it('when a directory cannot be listed', () => {
      const dist = fakeDist();
      overrides.readdirSync = (directory) => {
        throw Object.assign(new Error('denied'), { code: directory.endsWith('about') ? 'EACCES' : undefined });
      };

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot list .*: denied/);
    });

    it('when a read or a stat fails without an error code', () => {
      const dist = fakeDist();
      overrides.readFileSync = () => {
        throw new Error('boom');
      };
      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot read .*index\.html: boom/);

      overrides.readFileSync = undefined;
      overrides.lstatSync = () => {
        throw new Error('gone');
      };
      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot stat .*index\.html: gone/);
    });

    it('when the cause of a failure has an error code', () => {
      const dist = fakeDist();
      overrides.readdirSync = () => {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      };

      expect(() => planDirectory(dist, { now: NOW })).toThrow(/cannot list .*: EACCES/);
    });

    it('when fewer than the minimum number of files would be kept', () => {
      const dist = mkdtempSync(path.join(tmpdir(), 'prune-assets-'));
      boxes.push(dist);
      write(path.join(dist, 'index.html'), '<script type="module" src="/assets/index-CUR1.js"></script>', OLD);
      write(path.join(dist, 'assets/index-CUR1.js'), '', OLD);
      write(path.join(dist, 'assets/stale-OLD1.js'), '', OLD);

      expect(MIN_KEPT_FILES).toBe(5);
      expect(() => planDirectory(dist, { now: NOW })).toThrow(/only 1 files of 2 would be kept/);
    });

    it('but not at exactly the limits: five kept, and 90% deleted', () => {
      const dist = mkdtempSync(path.join(tmpdir(), 'prune-assets-'));
      boxes.push(dist);
      const kept = ['a', 'b', 'c', 'd'].map((letter) => `keep-${letter}.js`);
      write(
        path.join(dist, 'index.html'),
        `<script type="module" src="/assets/index-CUR1.js"></script>${kept.map((name) => `<i src="/assets/${name}">`).join('')}`,
        OLD,
      );
      for (const name of ['index-CUR1.js', ...kept]) write(path.join(dist, 'assets', name), '', OLD);
      for (let index = 0; index < 45; index += 1) write(path.join(dist, `assets/stale-${index}.js`), '', OLD);

      expect(planDirectory(dist, { now: NOW }).candidates).toHaveLength(45);
    });

    it('when more than the allowed share of the files would be deleted', () => {
      const dist = mkdtempSync(path.join(tmpdir(), 'prune-assets-'));
      boxes.push(dist);
      const names = ['a', 'b', 'c', 'd', 'e'].map((letter) => `keep-${letter}.js`);
      write(
        path.join(dist, 'index.html'),
        `<script type="module" src="/assets/index-CUR1.js"></script>${names.map((name) => `<i src="/assets/${name}">`).join('')}`,
        OLD,
      );
      write(path.join(dist, 'assets/index-CUR1.js'), '', OLD);
      for (const name of names) write(path.join(dist, 'assets', name), '', OLD);
      for (let index = 0; index < 70; index += 1) write(path.join(dist, `assets/stale-${index}.js`), '', OLD);

      expect(MAX_DELETE_FRACTION).toBe(0.9);
      expect(() => planDirectory(dist, { now: NOW })).toThrow(/70 of 76 files .* more than 90%/);
    });
  });
});

describe('run', () => {
  const collect = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, log: (line: string) => out.push(line), error: (line: string) => err.push(line) };
  };

  it('deletes the stale files of every directory, one by one, and logs counts and sizes', () => {
    const live = fakeDist({ siblings: true });
    const staging = fakeDist({ siblings: true });
    const io = collect();

    expect(run([staging, live], { ...io, now: NOW })).toBe(0);

    for (const dist of [live, staging]) {
      expect(listing(dist)).not.toContain('old-OLD1.js');
      expect(listing(dist)).not.toContain('old-OLD1.js.gz');
      expect(listing(dist)).toContain('index-CUR1.js.gz');
      expect(listing(dist)).toContain('recent-NEW1.js');
      expect(readFileSync(path.join(dist, 'index.html'), 'utf8')).toContain('index-CUR1.js');
    }
    expect(io.out.join('\n')).toMatch(/assets: \d+ files \(0\.0 MB\); 5 named by the current build, 0 requested in the access logs, \d+ kept in all; 6 stale/);
    expect(io.out.some((line) => /^ {2}deleted .*assets\/old-OLD1\.js$/.test(line))).toBe(true);
    expect(io.out.at(-1)).toBe('Deleted 12 stale asset files (0.0 MB).');
    expect(io.err).toEqual([]);
  });

  it('does nothing the second time', () => {
    const dist = fakeDist();
    const first = collect();
    const second = collect();

    run([dist], { ...first, now: NOW });
    const after = listing(dist);

    expect(run([dist], { ...second, now: NOW })).toBe(0);
    expect(listing(dist)).toEqual(after);
    expect(second.out.at(-1)).toBe('Deleted 0 stale asset files (0.0 MB).');
  });

  it('only reports in a dry run', () => {
    const dist = fakeDist();
    const before = listing(dist);
    const io = collect();

    expect(run(['--dry-run', dist], { ...io, now: NOW })).toBe(0);

    expect(listing(dist)).toEqual(before);
    expect(io.out).toContain('  would delete old-OLD1.js');
    expect(io.out.at(-1)).toBe('Dry run: nothing deleted.');
  });

  it('honours --max-age-days', () => {
    const dist = fakeDist();

    expect(run(['--max-age-days', '120', dist], { ...collect(), now: NOW })).toBe(0);

    expect(listing(dist)).toContain('old-OLD1.js');
  });

  it('runs against the real clock and console by default', () => {
    const dist = fakeDist();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(run(['--dry-run', dist])).toBe(0);

    expect(log).toHaveBeenCalled();
    log.mockRestore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(run([])).toBe(2);
    error.mockRestore();
  });

  it('deletes nothing anywhere when one directory fails a safety check', () => {
    const good = fakeDist();
    const bad = fakeDist();
    rmSync(path.join(bad, 'assets/index-CUR1.js'));
    const before = listing(good);
    const io = collect();

    expect(run([good, bad], { ...io, now: NOW })).toBe(1);

    expect(listing(good)).toEqual(before);
    expect(io.err[0]).toMatch(/^Asset retention aborted, nothing deleted: .*index-CUR1\.js, which is missing$/);
  });

  it('rejects bad arguments with exit code 2', () => {
    const dist = fakeDist();
    for (const argv of [[], ['--dry-run'], ['--bogus', dist], ['--max-age-days'], ['--max-age-days', 'x', dist], ['--max-age-days', '0', dist]]) {
      const io = collect();

      expect(run(argv, { ...io, now: NOW }), argv.join(' ')).toBe(2);
      expect(io.err).toHaveLength(1);
    }
  });

  it('skips anything that is no longer a regular file when it comes to deleting it', () => {
    const dist = fakeDist();
    const target = path.join(dist, 'assets/old-OLD1.js');
    const io = collect();
    // The plan sees a file; by the time of deletion the entry has become a directory.
    let swapped = false;
    overrides.lstatSync = (file) => {
      const stats = realLstat(file);
      if (file === target && swapped) return { isFile: () => false, isDirectory: () => true, size: 0, mtimeMs: 0 };
      if (file === target) swapped = true;
      return stats;
    };

    expect(run([dist], { ...io, now: NOW })).toBe(0);

    expect(listing(dist)).toContain('old-OLD1.js');
    expect(io.out.at(-1)).toBe('Deleted 3 stale asset files (0.0 MB).');
  });

  it('keeps going when a file cannot be deleted, names it, and exits 3', () => {
    const dist = fakeDist();
    const io = collect();
    overrides.unlinkSync = (file) => {
      if (file.endsWith('old-OLD1.js')) throw Object.assign(new Error('read-only'), { code: 'EROFS' });
      if (file.endsWith('old-dep-OLD2.js')) throw new Error('weird');
      if (file.endsWith('old-style-OLD3.css')) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      return realUnlink(file);
    };

    expect(run([dist], { ...io, now: NOW })).toBe(3);

    expect(io.err).toEqual([
      expect.stringMatching(/could not delete .*old-OLD1\.js: EROFS$/),
      expect.stringMatching(/could not delete .*old-dep-OLD2\.js: weird$/),
    ]);
    expect(io.out.at(-1)).toBe('Deleted 1 stale asset files (0.0 MB); 2 could not be deleted.');
    expect(listing(dist)).not.toContain('old-OLD1.js.map');
  });

  it('plans the second directory before deleting from the first', () => {
    const bad = fakeDist();
    const good = fakeDist();
    rmSync(path.join(bad, 'assets/style-CUR1.css'));
    const before = listing(good);

    expect(run([good, bad], { ...collect(), now: NOW })).toBe(1);
    expect(run([bad, good], { ...collect(), now: NOW })).toBe(1);
    expect(listing(good)).toEqual(before);
  });

  it('lets an unexpected error through instead of reporting a safety abort', () => {
    const dist = fakeDist();
    overrides.readFileSync = () => undefined;

    expect(() => run([dist], { ...collect(), now: NOW })).toThrow(TypeError);
  });
});

describe('access logs', () => {
  const line = (path: string, status: number, method = 'GET') =>
    `203.0.113.9 - - [12/Nov/2026:10:00:00 +0000] "${method} ${path} HTTP/2.0" ${status} 100 "-" "UA"`;
  const logBox = () => {
    const box = mkdtempSync(path.join(tmpdir(), 'prune-logs-'));
    boxes.push(box);
    return box;
  };

  it('reads successful asset requests from plain and gzipped logs and skips a missing file', () => {
    const box = logBox();
    writeFileSync(
      path.join(box, 'access.log'),
      [
        line('/assets/a-1.js', 200),
        line('/assets/b-2.css?v=1', 304),
        line('/assets/c-3.js', 404),
        line('/assets/d-4.js', 500),
        line('/about', 200),
        line('/assets/e-5.js', 200, 'POST'),
        line('/assets/sub/f-6.js', 206),
        line('/assets/h-7.js', 301, 'HEAD'),
      ].join('\n'),
    );
    writeFileSync(path.join(box, 'access.log.2.gz'), gzipSync(line('/assets/g-6.woff2', 200)));

    expect([...requestedNames([path.join(box, 'access.log'), path.join(box, 'access.log.2.gz'), path.join(box, 'access.log*')])].sort()).toEqual([
      'a-1.js',
      'b-2.css',
      'f-6.js',
      'g-6.woff2',
      'h-7.js',
    ]);
    expect(requestedNames([]).size).toBe(0);
  });

  it('aborts on a log in another format instead of counting it as readable', () => {
    const box = logBox();
    writeFileSync(path.join(box, 'access.log.3.xz'), Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00, 0x01, 0x02, 0xff]));
    writeFileSync(path.join(box, 'empty.log'), '');

    expect(() => requestedNames([path.join(box, 'access.log.3.xz')])).toThrow(/access\.log\.3\.xz does not look like an nginx access log/);
    expect(() => requestedNames([path.join(box, 'empty.log')])).toThrow(/no successful \/assets\/ request/);
  });

  it('reads a percent-encoded request path as written and decoded, and never decodes twice', () => {
    const box = logBox();
    writeFileSync(
      path.join(box, 'access.log'),
      [
        line('/assets/my%20file-E1.png', 200),
        line('/assets/a%2Bb-1.js', 200),
        line('/assets/c%40d-2.js', 304),
        line('/assets/bad%ZZ-3.js', 200),
        line('/assets/dbl%2520file-4.js', 200),
        line('/assets/sub%2Fnested-5.js', 200),
        line('/assets/gone%20file-6.js', 404),
      ].join('\n'),
    );

    const requested = requestedNames([path.join(box, 'access.log')]);

    expect([...requested].sort()).toEqual(
      [
        'a%2Bb-1.js',
        'a+b-1.js',
        'bad%ZZ-3.js',
        'c%40d-2.js',
        'c@d-2.js',
        'dbl%2520file-4.js',
        'dbl%20file-4.js',
        'my file-E1.png',
        'my%20file-E1.png',
        'nested-5.js',
        'sub%2Fnested-5.js',
      ].sort(),
    );
    // Decoded once only: the doubly encoded name does not become "dbl file-4.js"; a failed request adds nothing.
    expect(requested.has('dbl file-4.js')).toBe(false);
    expect(requested.has('gone file-6.js')).toBe(false);
  });

  it('keeps an old file whose name has a space when the log shows it requested as %20', () => {
    const dist = fakeDist();
    write(path.join(dist, 'assets/my file-E1.png'), 'png', OLD);
    write(path.join(dist, 'assets/other file-E2.png'), 'png', OLD);
    const box = logBox();
    writeFileSync(path.join(box, 'access.log'), line('/assets/my%20file-E1.png', 200));

    const plan = planDirectory(dist, { now: NOW, requested: requestedNames([path.join(box, 'access.log')]) });

    expect(plan.candidates).toContain('other file-E2.png');
    expect(plan.candidates).not.toContain('my file-E1.png');
  });

  it('aborts when a log cannot be read or decompressed', () => {
    const box = logBox();
    writeFileSync(path.join(box, 'broken.log.gz'), 'not gzip');

    expect(() => requestedNames([path.join(box, 'broken.log.gz')])).toThrow(/cannot decompress .*broken\.log\.gz/);
    // A directory in place of a log is a read error other than "not found".
    expect(() => requestedNames([box])).toThrow(/cannot read .*: EISDIR/);
    overrides.readFileSync = () => {
      throw new Error('boom');
    };
    expect(() => requestedNames(['/x/access.log'])).toThrow(/cannot read \/x\/access\.log: boom/);
  });

  it('keeps a stale file that is still requested with its siblings and what it imports, and plans the rest', () => {
    const dist = fakeDist({ siblings: true });
    const plan = planDirectory(dist, { now: NOW, requested: new Set(['old-OLD1.js', 'not-there.js']) });

    expect(plan.requestedKept).toBe(1);
    expect(plan.candidates).toEqual(['old-style-OLD3.css']);
  });

  it('stops when logs were asked for and none exists or none shows an asset request', () => {
    const box = logBox();
    writeFileSync(path.join(box, 'quiet.log'), line('/about', 200));

    expect(() => requestedNames([path.join(box, 'gone.log'), path.join(box, 'gone.log.1')])).toThrow(/none of the 2 access log files exists/);
    expect(() => requestedNames([path.join(box, 'quiet.log')])).toThrow(/no successful \/assets\/ request found in 1 access log file/);

    const dist = fakeDist();
    const err: string[] = [];
    expect(run(['--access-log', path.join(box, 'gone.log'), dist], { log: () => undefined, error: (l) => err.push(l), now: NOW })).toBe(1);
    expect(err[0]).toMatch(/nothing deleted: none of the 1 access log files exists/);
  });

  it('is applied by run() for every --access-log, and a missing value is a usage error', () => {
    const dist = fakeDist();
    const box = logBox();
    writeFileSync(path.join(box, 'access.log'), line('/assets/old-style-OLD3.css', 200));
    const io = { out: [] as string[], err: [] as string[] };
    const sink = { log: (l: string) => io.out.push(l), error: (l: string) => io.err.push(l), now: NOW };

    expect(run(['--dry-run', '--access-log', path.join(box, 'access.log'), dist], sink)).toBe(0);
    expect(io.out.join('\n')).toMatch(/1 requested in the access logs/);
    expect(io.out).not.toContain('  would delete old-style-OLD3.css');

    for (const argv of [['--access-log'], ['--access-log', '--dry-run', dist]]) {
      expect(run(argv, sink), argv.join(' ')).toBe(2);
    }
    expect(run(['--access-log', box, dist], sink)).toBe(1);
  });
});

/** A dist whose plan would delete 70 of 76 files (92%): over the default limit, inside a limit of 0.95. */
function backlogDist(): string {
  const dist = mkdtempSync(path.join(tmpdir(), 'prune-assets-'));
  boxes.push(dist);
  const names = ['a', 'b', 'c', 'd', 'e'].map((letter) => `keep-${letter}.js`);
  write(
    path.join(dist, 'index.html'),
    `<script type="module" src="/assets/index-CUR1.js"></script>${names.map((name) => `<i src="/assets/${name}">`).join('')}`,
    OLD,
  );
  write(path.join(dist, 'assets/index-CUR1.js'), '', OLD);
  for (const name of names) write(path.join(dist, 'assets', name), '', OLD);
  for (let index = 0; index < 70; index += 1) write(path.join(dist, `assets/stale-${index}.js`), '', OLD);
  return dist;
}

describe('--max-delete-fraction', () => {
  const collect = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, log: (line: string) => out.push(line), error: (line: string) => err.push(line) };
  };

  it('stops a backlog over the default limit, and names the flag in the reason', () => {
    const dist = backlogDist();
    const io = collect();

    expect(run([dist], { ...io, now: NOW })).toBe(1);
    expect(io.err.join('\n')).toMatch(/70 of 76 files .* more than 90% .*--max-delete-fraction/);
    expect(listing(dist)).toHaveLength(76);
  });

  it('allows that backlog when asked for a higher limit, and a lower limit stops a smaller plan', () => {
    const dist = backlogDist();
    const io = collect();

    expect(run(['--max-delete-fraction', '0.95', dist], { ...io, now: NOW })).toBe(0);
    expect(listing(dist)).toHaveLength(6);

    const smaller = fakeDist();
    const strict = collect();
    expect(run(['--max-delete-fraction', '0.1', smaller], { ...strict, now: NOW })).toBe(1);
    expect(strict.err.join('\n')).toMatch(/4 of \d+ files .* more than 10%/);
  });

  it('is applied by planDirectory, where 1 allows anything the five-file minimum does not stop', () => {
    expect(planDirectory(backlogDist(), { now: NOW, maxDeleteFraction: 1 }).candidates).toHaveLength(70);
    expect(() => planDirectory(backlogDist(), { now: NOW, maxDeleteFraction: 0.5 })).toThrow(/more than 50%/);
  });

  it('refuses a missing, empty or out-of-range value as a usage error before doing anything', () => {
    const bad = [['--max-delete-fraction'], ['--max-delete-fraction', ''], ['--max-delete-fraction', 'x'], ['--max-delete-fraction', '1.5'], ['--max-delete-fraction', '-0.1']];
    for (const argv of bad) {
      const dist = backlogDist();
      const io = collect();

      expect(run([...argv, dist], { ...io, now: NOW }), argv.join(' ')).toBe(2);
      expect(io.err.join('\n')).toMatch(/--max-delete-fraction needs a number from 0 to 1/);
      expect(listing(dist)).toHaveLength(76);
    }
  });
});

describe('names written in any form', () => {
  it('finds names with any extension, an "@2x" or a space (written out or percent-encoded), in any quoting, and a trailing dot', () => {
    const names = new Set(['sound-C1.mp3', 'font-D1.eot', 'logo@2x-B1.webp', 'my file-E1.png', 'my file-L1.png', 'tail-K1.mp3', 'plain-F1.js', 'a.js']);
    const text =
      'a("sound-C1.mp3");url(font-D1.eot?#iefix) "/assets/logo@2x-B1.webp" x:"my file-E1.png" ' +
      'url(/assets/my%20file-L1.png) see plain-F1.js and tail-K1.mp3. a.js';

    expect([...namesIn(text, names)].sort()).toEqual([
      'a.js',
      'font-D1.eot',
      'logo@2x-B1.webp',
      'my file-E1.png',
      'my file-L1.png',
      'plain-F1.js',
      'sound-C1.mp3',
      'tail-K1.mp3',
    ]);
    // "a.json" is the trap of a name pattern without a lookahead: it must not be read as a.js.
    expect([...namesIn('a.json', new Set(['a.js']))]).toEqual([]);
    // The odd-name list of a set is built once and reused.
    expect([...namesIn('logo@2x-B1.webp', names)]).toEqual(['logo@2x-B1.webp']);
    expect([...namesIn('tail-K1.mp3.', names)]).toEqual(['tail-K1.mp3']);
  });

  it('keeps old files that the current build names in an unusual way', () => {
    const dist = fakeDist();
    for (const name of ['logo@2x-B1.webp', 'sound-C1.mp3', 'font-D1.eot', 'my file-E1.png', 'mapped-G1.js', 'inner-H1.js']) {
      write(path.join(dist, 'assets', name), 'x', OLD);
    }
    write(path.join(dist, 'sw.js'), 'precache([{url:"/assets/pre-SW01.js"},{url:"/assets/logo@2x-B1.webp"}])', OLD);
    write(path.join(dist, 'about/index.html'), '<script src="/assets/page-ABT1.js"></script><audio src="/assets/sound-C1.mp3"></audio>', OLD);
    write(path.join(dist, 'assets/style-CUR1.css'), '@font-face{src:url(./font-FNT1.woff2)} @font-face{src:url(./font-D1.eot)} .a{background:url(img-BG1.svg)} .b{background:url("my file-E1.png")}', OLD);
    // Reached only through a kept SVG and a kept JSON file.
    write(path.join(dist, 'assets/img-BG1.svg'), '<svg><image href="inner-H1.js"/></svg>', OLD);
    write(path.join(dist, 'assets/data-J1.json'), '{"x":"mapped-G1.js"}', OLD);
    write(path.join(dist, 'robots.txt'), 'assets/data-J1.json', OLD);

    const { candidates } = planDirectory(dist, { now: NOW });

    expect(candidates).toEqual(['old-OLD1.js', 'old-OLD1.js.map', 'old-dep-OLD2.js', 'old-style-OLD3.css']);
  });
});

describe('entry point', () => {
  const script = path.resolve(__dirname, '../../scripts/prune-stale-assets.mjs');
  const scriptUrl = pathToFileURL(script).href;
  const collect = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, log: (line: string) => out.push(line), error: (line: string) => err.push(line), now: NOW };
  };

  it('is the entry point for the real path, for a typed path that is a link to it, and for nothing else', () => {
    const links = mkdtempSync(path.join(tmpdir(), 'prune-entry-'));
    boxes.push(links);
    symlinkSync(path.dirname(script), path.join(links, 'scripts'));
    const typed = path.join(links, 'scripts', 'prune-stale-assets.mjs');

    expect(isEntryPoint(scriptUrl, script)).toBe(true);
    // Through a link: only the real path matches the module URL.
    expect(isEntryPoint(scriptUrl, typed)).toBe(true);
    // With --preserve-symlinks-main the module URL keeps the typed path, which is not the real one.
    expect(isEntryPoint(pathToFileURL(typed).href, typed)).toBe(true);
    expect(isEntryPoint(scriptUrl, path.join(links, 'other.mjs'))).toBe(false);
    expect(isEntryPoint(scriptUrl, path.join(links, 'scripts', 'missing.mjs'))).toBe(false);
    expect(isEntryPoint(scriptUrl, path.resolve(__dirname, 'prune-stale-assets.test.ts'))).toBe(false);
    expect(isEntryPoint(scriptUrl, undefined)).toBe(false);
    expect(isEntryPoint(scriptUrl, '')).toBe(false);
  });

  it('runs the command line with the arguments after the script, and does nothing when it was only imported', () => {
    const dist = fakeDist();
    const before = listing(dist);
    const io = collect();

    expect(runCli(scriptUrl, ['node', script, '--dry-run', dist], io)).toBe(0);
    expect(io.out.at(-1)).toBe('Dry run: nothing deleted.');
    expect(listing(dist)).toEqual(before);

    expect(runCli(scriptUrl, ['node', script], io)).toBe(2);
    expect(runCli(scriptUrl, ['node', script, '--bogus'], io)).toBe(2);

    const other = collect();
    expect(runCli(scriptUrl, ['node', '/somewhere/else.mjs', '--dry-run', dist], other)).toBeNull();
    expect(runCli(scriptUrl, ['node'], other)).toBeNull();
    expect(other.out).toEqual([]);
    expect(other.err).toEqual([]);
  });
});

describe('command line', () => {
  const script = path.resolve(__dirname, '../../scripts/prune-stale-assets.mjs');
  const node = (scriptPath: string, ...args: string[]) => spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });

  it('runs when started as a script, with the exit code of run()', () => {
    const dist = fakeDist();
    const before = listing(dist);

    const dry = node(script, '--dry-run', dist);
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stdout).toMatch(/Dry run: nothing deleted\./);
    expect(listing(dist)).toEqual(before);

    expect(node(script).status).toBe(2);

    const real = node(script, dist);
    expect(real.status, real.stderr).toBe(0);
    expect(real.stdout).toMatch(/Deleted 4 stale asset files/);
    expect(listing(dist)).not.toContain('old-OLD1.js');
    expect(node(script, dist).stdout).toMatch(/Deleted 0 stale asset files/);
  });

  it('does not silently do nothing when started through a symbolic link to its directory', () => {
    const dist = fakeDist();
    const links = mkdtempSync(path.join(tmpdir(), 'prune-link-'));
    boxes.push(links);
    symlinkSync(path.dirname(script), path.join(links, 'scripts'));

    const result = node(path.join(links, 'scripts', 'prune-stale-assets.mjs'), '--dry-run', dist);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/Dry run: nothing deleted\./);
  });
});

describe('deploy wiring', () => {
  const workflow = readFileSync(path.resolve(__dirname, '../../../.github/workflows/deploy.yml'), 'utf8');
  const lines = workflow.split('\n');
  const lineOf = (needle: string) => {
    const index = lines.findIndex((line) => line.includes(needle));
    expect(index, `"${needle}" is present`).toBeGreaterThan(-1);
    return index;
  };

  it('prunes after the web root is synced and before nginx is reloaded', () => {
    const prune = lineOf('prune-stale-assets.mjs');

    expect(prune).toBeGreaterThan(lineOf('sudo rsync -a --delete "$STAGING_DIR/web/dist/" "$TARGET_DIR/web/dist/"'));
    expect(prune).toBeGreaterThan(lineOf('sudo rsync -a --delete "$STAGING_DIR/backend/scripts/" "$TARGET_DIR/backend/scripts/"'));
    expect(prune).toBeLessThan(lineOf('echo "==> Deploy: testing nginx and reloading"'));
  });

  it('covers the staging copy and the web root, and never removes a directory', () => {
    const line = lines[lineOf('prune-stale-assets.mjs')];

    expect(line).toContain('--access-log %s');
    expect(line).toContain('/var/log/nginx/access.log*');
    expect(line).toContain('"$STAGING_DIR/web/dist"');
    expect(line).toContain('"$TARGET_DIR/web/dist"');
    expect(line).not.toContain('--dry-run');
    expect(line).not.toMatch(/rm -r/);
  });

  it('does not stop the release when the pruning cannot run, and says so with the exit code', () => {
    const start = lineOf('prune-stale-assets.mjs');
    const block = lines.slice(start - 3, start + 4).join('\n');

    expect(lines[start]).toMatch(/\|\| prune_rc=\$\?$/);
    expect(block).toContain('prune_rc=0');
    expect(block).toContain('WARNING: stale asset pruning did not complete (exit $prune_rc');
    expect(block).not.toContain('|| true');
    expect(block).not.toMatch(/if ! sudo/);
  });
});
