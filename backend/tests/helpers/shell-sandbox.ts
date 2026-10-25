import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

export const scriptsDir = path.resolve(__dirname, '../../scripts');
export const helper = path.join(scriptsDir, 'alert-email.sh');

const scratchRoots: string[] = [];

// Every scratch directory made through this helper is removed when the test file finishes.
afterAll(() => {
  for (const dir of scratchRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A new temporary directory that is deleted after the test file has run. */
export function scratchDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratchRoots.push(dir);
  return dir;
}

export interface Sandbox {
  root: string;
  bin: string;
  mailLog: string;
  loggerLog: string;
}

/**
 * A scratch repo root with the given files, plus a bin directory holding fakes for `mail` and `logger`
 * that record what they are given (and a `mail` that exits with $MAIL_EXIT, default 0).
 */
export function sandbox(files: Record<string, string> = {}): Sandbox {
  const root = scratchDir('monitoring-');
  mkdirSync(path.join(root, 'backend'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), content);
  }
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const mailLog = path.join(root, 'mail.log');
  const loggerLog = path.join(root, 'logger.log');
  writeFileSync(path.join(bin, 'mail'), '#!/bin/bash\n{ echo "ARGS: $*"; cat; } >> "$MAIL_LOG"\nexit "${MAIL_EXIT:-0}"\n');
  writeFileSync(path.join(bin, 'logger'), '#!/bin/bash\necho "$*" >> "$LOGGER_LOG"\n');
  chmodSync(path.join(bin, 'mail'), 0o755);
  chmodSync(path.join(bin, 'logger'), 0o755);
  return { root, bin, mailLog, loggerLog };
}

export const readLog = (file: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

let caseCount = 0;

/**
 * Runs a bash snippet with a clean environment so nothing leaks in from the developer's shell. The
 * snippet is written to a script file and run as `bash <file>`; every path reaches it through an
 * environment variable, so no path is ever spliced into command text. `prelude` runs first.
 */
export function bash(
  script: string,
  box: Sandbox,
  env: Record<string, string> = {},
  input = '',
  { withRepoRoot = true, prelude = 'source "$ALERT_EMAIL_HELPER"' }: { withRepoRoot?: boolean; prelude?: string } = {},
): SpawnSyncReturns<string> {
  caseCount += 1;
  const file = path.join(box.root, `case-${caseCount}.sh`);
  writeFileSync(file, `${prelude}\n${script}\n`);
  return spawnSync('bash', [file], {
    encoding: 'utf8',
    input,
    env: {
      PATH: `${box.bin}:/usr/bin:/bin`,
      ALERT_EMAIL_HELPER: helper,
      MAIL_LOG: box.mailLog,
      LOGGER_LOG: box.loggerLog,
      ...(withRepoRoot ? { REPO_ROOT: box.root } : {}),
      ...env,
    },
  });
}

/** Runs an existing script file in a clean environment (paths only as arguments or environment variables). */
export function runFile(
  file: string,
  args: string[],
  box: Sandbox,
  env: Record<string, string> = {},
): SpawnSyncReturns<string> {
  return spawnSync('bash', [file, ...args], {
    encoding: 'utf8',
    env: {
      PATH: `${box.bin}:/usr/bin:/bin`,
      // Pinned so date-stamped state files have the same name in the test and in the script.
      TZ: 'UTC',
      MAIL_LOG: box.mailLog,
      LOGGER_LOG: box.loggerLog,
      REPO_ROOT: box.root,
      ...env,
    },
  });
}

const readScript = (name: string): string => readFileSync(path.join(scriptsDir, name), 'utf8');

/** Everything in a script up to and including its `ALERT_EMAIL="$(resolve_alert_email ...)"` line. */
export function preamble(name: string): string {
  const lines = readScript(name).split('\n');
  const end = lines.findIndex((line) => line.startsWith('ALERT_EMAIL="$(resolve_alert_email'));
  if (end === -1) {
    throw new Error(`${name} has no ALERT_EMAIL="$(resolve_alert_email ...)" line`);
  }
  return `${lines.slice(0, end + 1).join('\n')}\n`;
}

/** A script from its first line through the closing brace of one of its top-level functions. */
export function throughFunction(name: string, fn: string): string {
  const lines = readScript(name).split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${fn}() {`));
  if (start === -1) {
    throw new Error(`${name} has no ${fn}() function`);
  }
  const end = lines.findIndex((line, index) => index > start && line === '}');
  return `${lines.slice(0, end + 1).join('\n')}\n`;
}

/**
 * Installs a piece of a script into the sandbox the way the deploy installs scripts, next to a copy of
 * the helper, with its hard-coded /var/log, /var/tmp and /tmp locations redirected into the sandbox. Returns the
 * path of the installed file.
 */
export function install(box: Sandbox, name: string, text: string, { withHelper = true } = {}): string {
  const installDir = path.join(box.root, 'usr-local-bin');
  mkdirSync(installDir, { recursive: true });
  const file = path.join(installDir, name);
  // One pass, so a path that was just rewritten is never rewritten again (a sandbox under /tmp, as on
  // Linux, would otherwise match the /tmp rule a second time).
  writeFileSync(file, text.replace(/\/var\/log\/|\/var\/tmp\/|(?<=")\/tmp\//g, `${box.root}/`));
  chmodSync(file, 0o755);
  if (withHelper) {
    copyFileSync(helper, path.join(installDir, 'alert-email.sh'));
  }
  return file;
}
