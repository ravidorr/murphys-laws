import { chmodSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFile, sandbox, scriptsDir, type Sandbox } from '../helpers/shell-sandbox.ts';

// Runs the real check-pm2-health.sh over sample `pm2 logs murphys-api --lines 20 --nostream` output. A fake `pm2` on
// the PATH prints the sample (and exits with $FAKE_PM2_EXIT); the log files that the headers of the sample name are
// real files in a scratch directory, so the modification times that the marker comparison reads are under control.

const checker = path.join(scriptsDir, 'check-pm2-health.sh');
const WARNING = '⚠️  WARNING: Errors detected in logs';

const BANNER = '[TAILING] Tailing last 20 lines for [murphys-api] process (change the value with --lines option)';
const OUT_LINES = [
  '1|murphys-a | Server listening on port 8787',
  '1|murphys-a | Database opened: /root/murphys-laws/backend/db/murphys.db',
];
const ERROR_LINE = '1|murphys-a | Error: SQLITE_BUSY: database is locked';

interface Check {
  box: Sandbox;
  outLog: string;
  errorLog: string;
  marker: string;
  /** Output of `pm2 logs`: the banner, then a header and the given lines for the out log, then for the error log. */
  pm2Output: (out: string[], error: string[]) => string;
  run: (output: string, args?: string[], env?: Record<string, string>) => ReturnType<typeof runFile>;
}

// Seconds since the epoch: BEFORE < MARKER_TIME < AFTER.
const MARKER_TIME = 1_800_000_000;
const BEFORE = MARKER_TIME - 3600;
const AFTER = MARKER_TIME + 60;

function setup({ outTime = AFTER, errorTime = AFTER }: { outTime?: number; errorTime?: number } = {}): Check {
  const box = sandbox();
  const outLog = path.join(box.root, 'api-out-1.log');
  const errorLog = path.join(box.root, 'api-error-1.log');
  const marker = path.join(box.root, '.pm2-restart');
  for (const [file, time] of [[outLog, outTime], [errorLog, errorTime], [marker, MARKER_TIME]] as const) {
    writeFileSync(file, '');
    utimesSync(file, time, time);
  }
  const fakePm2 = path.join(box.bin, 'pm2');
  writeFileSync(fakePm2, '#!/bin/bash\necho "$*" > "$FAKE_PM2_ARGS"\ncat "$FAKE_PM2_OUTPUT"\nexit "${FAKE_PM2_EXIT:-0}"\n');
  chmodSync(fakePm2, 0o755);
  let count = 0;
  return {
    box,
    outLog,
    errorLog,
    marker,
    pm2Output: (out, error) =>
      [BANNER, `${outLog} last 20 lines:`, ...out, `${errorLog} last 20 lines:`, ...error, ''].join('\n'),
    run: (output, args = [], env = {}) => {
      count += 1;
      const sample = path.join(box.root, `pm2-output-${count}.txt`);
      writeFileSync(sample, output);
      return runFile(checker, args, box, { FAKE_PM2_OUTPUT: sample, FAKE_PM2_ARGS: path.join(box.root, 'pm2-args.txt'), ...env });
    },
  };
}

describe('check-pm2-health.sh', () => {
  it('prints nothing for a healthy deploy: the error log file name in its header is not an error', () => {
    const t = setup();
    // The shape that the real server printed after a healthy deploy (issue #349): a banner, then a header and the
    // lines of each log file; none of the lines is an error.
    const result = t.run(t.pm2Output(OUT_LINES, []), [t.marker]);
    expect(t.pm2Output(OUT_LINES, [])).toContain('api-error-1.log last 20 lines:');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    // Without --nostream, pm2 would follow the logs forever and the deploy would hang.
    expect(readFileSync(path.join(t.box.root, 'pm2-args.txt'), 'utf8')).toBe('logs murphys-api --lines 20 --nostream\n');
  });

  it('prints the line and the warning for an error written after the restart', () => {
    const t = setup();
    const result = t.run(t.pm2Output(OUT_LINES, [ERROR_LINE]), [t.marker]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${ERROR_LINE}\n${WARNING}\n`);
  });

  it('ignores error lines in a log file that was not written to since the restart, and checks the other file', () => {
    const t = setup({ errorTime: BEFORE });
    const stale = t.run(t.pm2Output(OUT_LINES, [ERROR_LINE, '1|murphys-a | TypeError: x is not a function']), [t.marker]);
    expect(stale.status).toBe(0);
    expect(stale.stdout).toBe('');
    // The skip is per file: a bad line in the file that was written to still warns.
    const oneStale = t.run(t.pm2Output(['1|murphys-a | Unhandled error in request'], [ERROR_LINE]), [t.marker]);
    expect(oneStale.stdout).toBe('1|murphys-a | Unhandled error in request\n' + WARNING + '\n');
  });

  it('does not carry the skip of a stale file over to the next one, which is where a startup crash lands', () => {
    const t = setup({ outTime: BEFORE });
    const result = t.run(t.pm2Output(['1|murphys-a | old error from an earlier run'], [ERROR_LINE]), [t.marker]);
    expect(result.stdout).toBe(`${ERROR_LINE}\n${WARNING}\n`);
    // Also when the header of the next file is not exactly the expected shape (trailing space, carriage return).
    for (const tail of [' ', '\r']) {
      const odd = t.pm2Output(['1|murphys-a | old error from an earlier run'], [ERROR_LINE]).replace('api-error-1.log last 20 lines:', `api-error-1.log last 20 lines:${tail}`);
      expect(t.run(odd, [t.marker]).stdout).toBe(`${ERROR_LINE}\n${WARNING}\n`);
    }
  });

  it('counts a log file with the same modification time as the marker as written after the restart', () => {
    // A startup crash lands a moment after `pm2 start`, so a tie must never hide it.
    const t = setup({ errorTime: MARKER_TIME });
    const result = t.run(t.pm2Output(OUT_LINES, [ERROR_LINE]), [t.marker]);
    expect(result.stdout).toBe(`${ERROR_LINE}\n${WARNING}\n`);
  });

  it('checks every line when there is no marker, when the marker does not exist, and when a log file cannot be found', () => {
    const stale = setup({ errorTime: BEFORE });
    const output = stale.pm2Output(OUT_LINES, [ERROR_LINE]);
    const expected = `${ERROR_LINE}\n${WARNING}\n`;
    expect(stale.run(output).stdout).toBe(expected);
    expect(stale.run(output, [path.join(stale.box.root, 'no-such-marker')]).stdout).toBe(expected);
    const missingFile = output.replaceAll(stale.errorLog, path.join(stale.box.root, 'no-such-dir/api-error-1.log'));
    expect(stale.run(missingFile, [stale.marker]).stdout).toBe(expected);
  });

  it('catches a native module version mismatch in either stream, in any letter case', () => {
    const t = setup();
    const mismatch = [
      '1|murphys-a | was compiled against a different Node.js version using',
      '1|murphys-a | NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 131.',
    ];
    const streams: [string[], string[]][] = [[mismatch, []], [OUT_LINES, mismatch]];
    for (const [out, error] of streams) {
      const result = t.run(t.pm2Output(out, error), [t.marker]);
      expect(result.stdout).toBe(`${mismatch[1]}\n${WARNING}\n`);
    }
    expect(t.run(t.pm2Output([], ['1|murphys-a | ERROR in handler']), [t.marker]).stdout).toBe(
      `1|murphys-a | ERROR in handler\n${WARNING}\n`,
    );
  });

  it('does not read the banner or a header as a log line, wherever they appear', () => {
    const t = setup();
    const noisy = [
      '[TAILING] Tailing last 20 lines for [murphys-api] process: error.log and module version',
      `${t.errorLog} last 20 lines:`,
      '/root/murphys-laws/backend/logs/api-error-17.log last 20 lines:',
      '/root/murphys-laws/backend/logs/api-error.log module version last 5 lines:',
      '',
    ].join('\n');
    const result = t.run(noisy, [t.marker]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('only warns: it exits 0 with warnings, and says so on stderr when it cannot read the logs', () => {
    const t = setup();
    expect(t.run(t.pm2Output([], [ERROR_LINE]), [t.marker]).status).toBe(0);
    const failed = t.run('pm2: daemon is not running\n', [t.marker], { FAKE_PM2_EXIT: '3' });
    expect(failed.status).toBe(0);
    expect(failed.stdout).toBe('');
    expect(failed.stderr).toBe(
      'WARNING: could not read the PM2 logs of murphys-api (pm2 exit 3), so they were not checked\npm2: daemon is not running\n',
    );
  });
});
