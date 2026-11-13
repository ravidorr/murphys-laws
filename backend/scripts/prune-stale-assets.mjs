#!/usr/bin/env node
/**
 * Retention rule for the built web assets on the server.
 *
 * The deploy uploads web/dist/ into a persistent staging directory with no delete (scp-action) and mirrors that
 * directory into the web root with `rsync --delete`. Nothing ever removes a file from either copy, so every
 * release leaves its hashed bundles behind (about 650 MB and 1,185 files in assets/ after nine months). Old
 * bundles do matter for a while: a visitor or crawler holding a cached page asks for the chunks of the release
 * that page came from. This script removes only files older than --max-age-days that nothing in the current
 * build reaches and that the access logs show nobody requesting.
 *
 * For each dist directory given, it keeps a file under assets/ when ANY of these holds:
 *   1. it is named by the current build: every text file of the dist directory outside assets/ (html, js, mjs, css,
 *      json, webmanifest, xml, txt and _redirects: the prerendered pages, manifest.webmanifest, sw.js with the
 *      precache list inside it, offline.js, ...) is scanned for asset file names;
 *   2. it is named by a kept file: every kept JavaScript and CSS file, including old files kept by another rule, is
 *      scanned for asset file names (static and dynamic imports, the __vite__mapDeps lists and CSS url()
 *      references all contain one), until nothing new turns up;
 *   3. it was modified within the last --max-age-days days (default 30);
 *   4. it is the .gz, .br or .map sibling of a kept file. The build writes .gz and .br copies next to each
 *      .css, .js and .svg file, and a .map exists only when the Sentry upload did not delete it. The script works
 *      the same without any siblings.
 *   5. with --access-log, it was requested successfully (status 2xx or 3xx) in one of the nginx access logs given
 *      (the deploy passes all of them, about 14 days with the server's logrotate rule, which this repository does
 *      not manage): somebody still loads it, typically an old page held in a cache or a crawler. Responses carry a
 *      one-year Cache-Control, so the logs show cache misses only, and the rule is a safety net, not a guarantee.
 * Only older files that none of those rules keeps are deleted, one named file at a time. A directory is never
 * removed, and symbolic links and anything that is not a regular file are left alone.
 *
 * Nothing is deleted when the picture looks wrong: a directory without index.html or assets/, an index.html
 * that names no entry script, an entry script or stylesheet it names that is missing, a file that cannot be
 * read, an access log that cannot be read or does not look like an nginx access log, none of the --access-log
 * files existing or no asset request found in them when logs were asked for (the safety net would be switched
 * off), fewer than MIN_KEPT_FILES files kept, or a plan that would delete more than MAX_DELETE_FRACTION of the
 * files. Every directory is planned before the first file is deleted, so a problem in one stops all of them.
 * Files outside assets/ that are not regular files (named pipes, devices) are not read.
 * Running it again right away finds nothing to do.
 *
 * Plain JavaScript on purpose: it runs on the server straight after the upload, with no packages installed.
 *
 * Usage: node backend/scripts/prune-stale-assets.mjs [--dry-run] [--max-age-days N] [--access-log FILE ...] <dist-dir> ...
 * An --access-log file that does not exist is skipped (a rotated name that is gone); a file that cannot be read aborts.
 * Exit codes: 0 done (or dry run), 1 nothing deleted because a safety check failed (or an unexpected error stopped
 * the planning), 2 bad usage, 3 deleting finished with failures (some files could not be removed; the output
 * names each).
 */

import { lstatSync, readdirSync, readFileSync, realpathSync, statSync, unlinkSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const DEFAULT_MAX_AGE_DAYS = 30;
export const MIN_KEPT_FILES = 5;
export const MAX_DELETE_FRACTION = 0.9;

const DAY_MS = 24 * 60 * 60 * 1000;
// A file name inside a script, page or stylesheet that looks like a build output.
// A name ends where the extension ends: without the lookahead "a.json" would give "a.js".
const NAME_PATTERN = /[A-Za-z0-9_.-]+\.(?:json|js|mjs|css|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|wasm)(?![A-Za-z0-9_])/g;
// Files outside assets/ that can name an asset.
const ROOT_TEXT_PATTERN = /\.(?:html?|js|mjs|css|json|webmanifest|xml|txt)$|^_redirects$/;
const SCANNED_ASSET_PATTERN = /\.(?:js|mjs|css)$/;
const SIBLING_SUFFIXES = ['.gz', '.br', '.map'];

class RetentionAbort extends Error {}

function abort(message) {
  throw new RetentionAbort(message);
}

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return abort(`cannot read ${file}: ${error.code ?? error.message}`);
  }
}

function listDirectory(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    return abort(`cannot list ${directory}: ${error.code ?? error.message}`);
  }
}

function statFile(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    return abort(`cannot stat ${file}: ${error.code ?? error.message}`);
  }
}

/** True for a regular file or a link to one; a named pipe or a device is never read (it could block forever). */
function isRegularFile(file) {
  try {
    return statSync(file).isFile();
  } catch (error) {
    return abort(`cannot read ${file}: ${error.code}`);
  }
}

function walk(directory, visit) {
  for (const entry of listDirectory(directory)) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full, entry);
  }
}

/** The asset file names that an nginx access log shows as successfully requested (2xx or 3xx) from /assets/. */
export function requestedNames(logPaths) {
  const requested = new Set();
  let readable = 0;
  let requests = 0;
  for (const file of logPaths) {
    let raw;
    try {
      raw = readFileSync(file);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      abort(`cannot read ${file}: ${error.code ?? error.message}`);
    }
    let text;
    try {
      text = (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8');
    } catch (error) {
      abort(`cannot decompress ${file}: ${error.message}`);
    }
    // A rotated log in another format (.xz, .bz2, ...) would decode to noise and silently shrink the safety net.
    if (text.length > 0 && !/"[A-Z]+ \S+ HTTP\/[\d.]+" \d{3} /.test(text)) abort(`${file} does not look like an nginx access log`);
    readable += 1;
    for (const match of text.matchAll(/"(?:GET|HEAD) \/assets\/([^ ?"]+)[^"]*" [23]\d\d /g)) {
      requested.add(basename(match[1]));
      requests += 1;
    }
  }
  // Logs were asked for but none could be used: the rule would silently keep nothing, so stop instead.
  if (logPaths.length > 0 && readable === 0) abort(`none of the ${logPaths.length} access log files exists`);
  if (logPaths.length > 0 && requests === 0) abort(`no successful /assets/ request found in ${readable} access log file(s)`);
  return requested;
}

/** The asset names a text mentions that exist in `names`. */
export function namesIn(text, names) {
  return new Set((text.match(NAME_PATTERN) ?? []).filter((name) => names.has(name)));
}

/** The /assets/ files the entry page loads: the scripts and the linked files (stylesheets, preloads) named in index.html. */
export function entryAssets(indexHtml) {
  const scripts = [...indexHtml.matchAll(/<script\b[^>]*\bsrc="\/assets\/([^"?#]+)(?:[?#][^"]*)?"/g)].map((match) => match[1]);
  const styles = [...indexHtml.matchAll(/<link\b[^>]*\bhref="\/assets\/([^"?#]+)(?:[?#][^"]*)?"/g)].map((match) => match[1]);
  return { scripts, styles };
}

/**
 * Works out what to keep and what to delete under <dist>/assets/ without touching anything.
 * Throws RetentionAbort when a safety check fails.
 */
export function planDirectory(dist, { now = Date.now(), maxAgeDays = DEFAULT_MAX_AGE_DAYS, requested = new Set() } = {}) {
  const assets = join(dist, 'assets');
  if (!statFile(join(dist, 'index.html')).isFile()) abort(`${dist}/index.html is not a file`);
  if (!statFile(assets).isDirectory()) abort(`${assets} is not a directory`);

  // Every regular file under assets/, keyed by its path relative to assets/.
  const files = new Map();
  walk(assets, (full, entry) => {
    const stats = statFile(full);
    if (entry.isFile() && stats.isFile()) files.set(relative(assets, full).split(sep).join('/'), stats);
  });
  const byName = new Map();
  for (const key of files.keys()) {
    const name = basename(key);
    byName.set(name, [...(byName.get(name) ?? []), key]);
  }
  const names = new Set(byName.keys());

  // The entry page must be intact: its scripts exist, and it names at least one.
  const entry = entryAssets(read(join(dist, 'index.html')));
  if (entry.scripts.length === 0) abort(`${dist}/index.html names no entry script`);
  for (const file of [...entry.scripts, ...entry.styles]) {
    if (!files.has(file)) abort(`${dist}/index.html names assets/${file}, which is missing`);
  }

  const keep = new Set();
  const keepName = (name) => {
    for (const key of byName.get(name)) keep.add(key);
  };

  // Rule 1: named by the files outside assets/.
  walk(dist, (full) => {
    if (full.startsWith(`${assets}${sep}`)) return;
    if (!ROOT_TEXT_PATTERN.test(basename(full)) || !isRegularFile(full)) return;
    for (const name of namesIn(read(full), names)) keepName(name);
  });
  const referenced = keep.size;

  // Rule 3: modified recently.
  const cutoff = now - maxAgeDays * DAY_MS;
  for (const [key, stats] of files) if (stats.mtimeMs >= cutoff) keep.add(key);

  // Rule 5: still requested, according to the access logs.
  let requestedKept = 0;
  for (const name of requested) {
    if (names.has(name)) {
      requestedKept += 1;
      keepName(name);
    }
  }

  // Rule 2: reachable from a kept script or stylesheet, until nothing new turns up.
  const scanned = new Set();
  for (let pending = [...keep]; pending.length > 0; ) {
    const next = [];
    for (const key of pending) {
      if (scanned.has(key) || !SCANNED_ASSET_PATTERN.test(key)) continue;
      scanned.add(key);
      for (const name of namesIn(read(join(assets, key)), names)) {
        for (const found of byName.get(name)) {
          if (!keep.has(found)) {
            keep.add(found);
            next.push(found);
          }
        }
      }
    }
    pending = next;
  }

  // Rule 4: the .gz, .br and .map siblings of kept files.
  for (const key of [...keep]) {
    for (const suffix of SIBLING_SUFFIXES) if (files.has(key + suffix)) keep.add(key + suffix);
  }

  const candidates = [...files.keys()].filter((key) => !keep.has(key)).sort();
  const size = (keys) => keys.reduce((sum, key) => sum + files.get(key).size, 0);

  if (keep.size < MIN_KEPT_FILES) abort(`only ${keep.size} files of ${files.size} would be kept in ${assets}`);
  if (candidates.length > files.size * MAX_DELETE_FRACTION) {
    abort(`${candidates.length} of ${files.size} files in ${assets} would be deleted, which is more than ${MAX_DELETE_FRACTION * 100}%`);
  }

  return {
    dist,
    assets,
    total: files.size,
    totalBytes: size([...files.keys()]),
    referenced,
    requestedKept,
    kept: keep.size,
    candidates,
    candidateBytes: size(candidates),
  };
}

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

/** Runs the plan for every directory, then deletes. Returns the exit code. */
export function run(argv, { log = console.log, error = console.error, now = Date.now() } = {}) {
  let dryRun = false;
  let maxAgeDays = DEFAULT_MAX_AGE_DAYS;
  const accessLogs = [];
  const directories = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      dryRun = true;
    } else if (argument === '--max-age-days') {
      maxAgeDays = Number(argv[index + 1]);
      index += 1;
      if (!Number.isFinite(maxAgeDays) || maxAgeDays < 1) {
        error('--max-age-days needs a number of at least 1');
        return 2;
      }
    } else if (argument === '--access-log') {
      const file = argv[index + 1];
      index += 1;
      if (file === undefined || file.startsWith('-')) {
        error('--access-log needs a file');
        return 2;
      }
      accessLogs.push(file);
    } else if (argument.startsWith('-')) {
      error(`unknown option ${argument}`);
      return 2;
    } else {
      directories.push(argument);
    }
  }
  if (directories.length === 0) {
    error('usage: prune-stale-assets.mjs [--dry-run] [--max-age-days N] [--access-log FILE ...] <dist-dir> [<dist-dir> ...]');
    return 2;
  }

  let plans;
  try {
    const requested = requestedNames(accessLogs);
    plans = directories.map((dist) => planDirectory(dist, { now, maxAgeDays, requested }));
  } catch (caught) {
    if (!(caught instanceof RetentionAbort)) throw caught;
    error(`Asset retention aborted, nothing deleted: ${caught.message}`);
    return 1;
  }

  for (const plan of plans) {
    log(
      `${plan.assets}: ${plan.total} files (${megabytes(plan.totalBytes)}); ${plan.referenced} named by the current build, ` +
        `${plan.requestedKept} requested in the access logs, ${plan.kept} kept in all; ${plan.candidates.length} stale (${megabytes(plan.candidateBytes)}).`,
    );
    if (dryRun) for (const key of plan.candidates.slice(0, 5)) log(`  would delete ${key}`);
  }

  if (dryRun) {
    log('Dry run: nothing deleted.');
    return 0;
  }
  let deleted = 0;
  let failed = 0;
  let bytes = 0;
  for (const plan of plans) {
    for (const key of plan.candidates) {
      const file = join(plan.assets, key);
      try {
        // Re-check just before deleting: only a regular file, never a link or a directory.
        const stats = lstatSync(file);
        if (!stats.isFile()) continue;
        unlinkSync(file);
        deleted += 1;
        bytes += stats.size;
        if (deleted <= 5) log(`  deleted ${file}`);
      } catch (caught) {
        // Already gone (a parallel cleanup) is the goal reached; anything else is reported and the run goes on.
        if (caught.code === 'ENOENT') continue;
        failed += 1;
        error(`  could not delete ${file}: ${caught.code ?? caught.message}`);
      }
    }
  }
  log(`Deleted ${deleted} stale asset files (${megabytes(bytes)})${failed > 0 ? `; ${failed} could not be deleted` : ''}.`);
  return failed > 0 ? 3 : 0;
}

/* v8 ignore start -- command-line entry point; run() is covered through its arguments */
// import.meta.url is the real path of the file (the typed one with --preserve-symlinks-main), process.argv[1] the path
// as it was typed: accept either, or a run through a symbolic link (a web root that is one, a temporary directory
// under /var on macOS) would do nothing and still exit 0.
const here = process.argv[1] && fileURLToPath(import.meta.url);
if (here && (here === realpathSync(process.argv[1]) || here === resolve(process.argv[1]))) {
  process.exit(run(process.argv.slice(2)));
}
/* v8 ignore stop */
