import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  bash,
  helper,
  install,
  preamble,
  readLog,
  runFile,
  sandbox,
  scriptsDir,
  throughFunction,
  type Sandbox,
} from '../helpers/shell-sandbox.ts';

// The scripts that email and so load the shared helper. (vulnerability-scanner.sh sends nothing: the
// daily report mails its output.)
const MAILING_SCRIPTS = [
  'cost-optimization-report.sh',
  'health-check.sh',
  'health-monitor.sh',
  'ssl-monitor.sh',
  'test-backup-restore.sh',
];
const root = (...parts: string[]) => path.resolve(__dirname, '../../..', ...parts);
const source = (name: string) => readFileSync(path.join(scriptsDir, name), 'utf8');

describe.each(MAILING_SCRIPTS)('%s loads the alert helper', (name) => {
  /** The script's own opening lines, installed like the deploy installs it, then a marker line. */
  const run = (box: Sandbox, env: Record<string, string> = {}, { withHelper = true, via = '' } = {}) => {
    const file = install(box, name, `${preamble(name)}echo "REACHED:$ALERT_EMAIL"\n`, { withHelper });
    let target = file;
    if (via) {
      mkdirSync(path.join(box.root, via), { recursive: true });
      target = path.join(box.root, via, name);
      symlinkSync(file, target);
    }
    return runFile(target, [], box, env);
  };

  it('finds the helper beside the installed script and resolves the recipient', () => {
    const result = run(sandbox(), { EMAIL_TO: 'admin@example.com' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('REACHED:admin@example.com');
  });

  it('still finds the helper when run through a symlink in another directory', () => {
    const result = run(sandbox(), { EMAIL_TO: 'admin@example.com' }, { via: 'elsewhere' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('REACHED:admin@example.com');
  });

  it('falls back to the repo copy under REPO_ROOT when the helper is not beside the script', () => {
    const box = sandbox();
    mkdirSync(path.join(box.root, 'backend/scripts'), { recursive: true });
    writeFileSync(path.join(box.root, 'backend/scripts/alert-email.sh'), readFileSync(helper));
    const result = run(box, { EMAIL_TO: 'admin@example.com' }, { withHelper: false });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('REACHED:admin@example.com');
  });

  it('stops with a clear error, and never carries on, when the helper cannot be found anywhere', () => {
    const box = sandbox();
    const result = run(box, { EMAIL_TO: 'admin@example.com' }, { withHelper: false });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('FATAL: cannot load alert-email.sh');
    expect(result.stdout).not.toContain('REACHED');
    expect(readLog(box.loggerLog)).toContain('cannot load alert-email.sh');
  });

  it('reads the recipient from the server .env when cron gives it no environment', () => {
    const result = run(sandbox({ 'backend/.env': 'EMAIL_TO="ops@example.com" # on-call\n' }));
    expect(result.stdout).toContain('REACHED:ops@example.com');
  });

  it('honors HEALTH_CHECK_EMAIL_TO only in health-check.sh', () => {
    const result = run(sandbox(), { HEALTH_CHECK_EMAIL_TO: 'health@example.com', EMAIL_TO: 'admin@example.com' });
    expect(result.stdout).toContain(name === 'health-check.sh' ? 'REACHED:health@example.com' : 'REACHED:admin@example.com');
  });
});

describe('alert state is recorded only after the mail was accepted', () => {
  const driver = 'send_alert "Disk full" "details" "disk"; echo "rc=$?"; echo "undelivered=${ALERT_UNDELIVERED:-0}"\n';

  describe.each([
    ['health-check.sh', 'health-check-alerts/disk', 'ALERT SUPPRESSED (cooldown)'],
    ['ssl-monitor.sh', 'ssl-alerts/disk-<today>', 'ALERT SUPPRESSED (already sent today)'],
  ])('%s', (name, stateTemplate, suppressed) => {
    // The script runs with TZ=UTC (see runFile), so its date matches this one. Computed when a test runs,
    // not when the file is collected.
    const stateFile = () => stateTemplate.replace('<today>', new Date().toISOString().slice(0, 10));
    const run = (box: Sandbox, env: Record<string, string> = {}) => {
      const file = install(box, name, throughFunction(name, 'send_alert') + driver);
      return runFile(file, [], box, env);
    };
    const log = (box: Sandbox) => readLog(path.join(box.root, name.replace('.sh', '.log')));

    it('sends, logs ALERT SENT, starts the suppression, and suppresses the repeat', () => {
      const box = sandbox();
      const first = run(box, { EMAIL_TO: 'admin@example.com' });
      expect(first.status).toBe(0);
      expect(first.stdout).toContain('undelivered=0');
      expect(log(box)).toMatch(/ALERT SENT: .*Disk full/);
      expect(readLog(box.mailLog)).toContain('details');
      expect(existsSync(path.join(box.root, stateFile()))).toBe(true);

      // A suppressed repeat is not a failed delivery.
      expect(run(box, { EMAIL_TO: 'admin@example.com' }).stdout).toContain('undelivered=0');
      expect(log(box)).toContain(suppressed);
      expect(readLog(box.mailLog).match(/ARGS:/g)).toHaveLength(1);
    });

    it('says the alert was NOT sent, and starts no suppression, when there is no recipient', () => {
      const box = sandbox();
      expect(run(box).stdout).toContain('undelivered=1');
      expect(log(box)).toContain('ALERT NOT SENT (no recipient configured)');
      expect(log(box)).not.toContain('ALERT SENT');
      expect(existsSync(path.join(box.root, stateFile()))).toBe(false);

      // Once a recipient is configured, the next alert goes out instead of being hidden by the dropped one.
      run(box, { EMAIL_TO: 'admin@example.com' });
      expect(log(box)).toMatch(/ALERT SENT: .*Disk full/);
      expect(readLog(box.mailLog)).toContain('ARGS:');
    });

    it('says the alert was NOT sent, and starts no suppression, when mail fails', () => {
      const box = sandbox();
      expect(run(box, { EMAIL_TO: 'admin@example.com', MAIL_EXIT: '1' }).stdout).toContain('undelivered=1');
      expect(log(box)).toContain('ALERT NOT SENT (mail exited with status 1)');
      expect(log(box)).not.toContain('ALERT SENT');
      expect(existsSync(path.join(box.root, stateFile()))).toBe(false);
    });
  });

  describe('state edge cases', () => {
    const sendFrom = (box: Sandbox, name: string, env: Record<string, string> = {}) =>
      runFile(install(box, name, throughFunction(name, 'send_alert') + driver), [], box, env);

    it('health-check.sh sends again once the cooldown has passed, and refreshes the timestamp', () => {
      const box = sandbox();
      const state = path.join(box.root, 'health-check-alerts/disk');
      mkdirSync(path.dirname(state), { recursive: true });
      const stale = Math.floor(Date.now() / 1000) - 7200;
      writeFileSync(state, `${stale}\n`);

      sendFrom(box, 'health-check.sh', { EMAIL_TO: 'admin@example.com' });
      expect(readLog(box.mailLog).match(/ARGS:/g)).toHaveLength(1);
      expect(Number(readFileSync(state, 'utf8'))).toBeGreaterThan(stale + 3600);
    });

    it('health-check.sh keeps each alert type separate, so a failed send leaves another type alone', () => {
      const box = sandbox();
      const other = path.join(box.root, 'health-check-alerts/cpu');
      mkdirSync(path.dirname(other), { recursive: true });
      writeFileSync(other, '12345\n');

      sendFrom(box, 'health-check.sh', { EMAIL_TO: 'admin@example.com', MAIL_EXIT: '1' });
      expect(readFileSync(other, 'utf8')).toBe('12345\n');
      expect(existsSync(path.join(box.root, 'health-check-alerts/disk'))).toBe(false);
    });

    it('ssl-monitor.sh clears week-old state files only after a send that worked', () => {
      const old = (box: Sandbox) => {
        const file = path.join(box.root, 'ssl-alerts/disk-2000-01-01');
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, '');
        const longAgo = new Date('2000-01-01T00:00:00Z');
        utimesSync(file, longAgo, longAgo);
        return file;
      };

      const sent = sandbox();
      const oldSent = old(sent);
      sendFrom(sent, 'ssl-monitor.sh', { EMAIL_TO: 'admin@example.com' });
      expect(existsSync(oldSent)).toBe(false);

      const dropped = sandbox();
      const oldDropped = old(dropped);
      sendFrom(dropped, 'ssl-monitor.sh');
      expect(existsSync(oldDropped)).toBe(true);
    });
  });

  describe('health-monitor.sh', () => {
    const run = (box: Sandbox, env: Record<string, string> = {}) => {
      const file = install(box, 'health-monitor.sh', `${throughFunction('health-monitor.sh', 'send_alert')}${driver}`);
      return runFile(file, [], box, env);
    };
    const log = (box: Sandbox) => readLog(path.join(box.root, 'health-monitor.log'));

    it('logs the real outcome and returns it', () => {
      const sent = sandbox();
      expect(run(sent, { EMAIL_TO: 'admin@example.com' }).stdout).toContain('rc=0');
      expect(log(sent)).toContain('Alert sent: Disk full');

      const dropped = sandbox();
      expect(run(dropped).stdout).toContain('rc=3');
      expect(log(dropped)).toContain('ALERT NOT SENT (no recipient configured): Disk full');
      expect(log(dropped)).not.toContain('Alert sent');

      const failed = sandbox();
      expect(run(failed, { EMAIL_TO: 'admin@example.com', MAIL_EXIT: '1' }).stdout).toContain('rc=1');
      expect(log(failed)).toContain('ALERT NOT SENT (mail exited with status 1)');
    });

    it('no longer claims an alert was sent after a restart regardless of the mail', () => {
      // A guard on a deleted string; the behavior is covered by the logs asserted above.
      expect(source('health-monitor.sh')).not.toContain('Services restarted. Alert sent.');
    });
  });
});

/** Runs the whole of health-monitor.sh against a fake project, fake tsx, fake pm2 and a fake mail. */
describe('health-monitor.sh as cron runs it', () => {
  const SCRIPT = 'health-monitor.sh';

  interface Run {
    status: number | null;
    box: Sandbox;
    tsxArgs: string;
    failures: string | null;
    log: string;
    mail: string;
    pm2: string;
    pings: string;
    timeouts: string;
  }

  interface MonitorOptions {
    /** The failure count already on disk. */
    failures?: number;
    /** The failure-count file's raw content instead (to test a malformed file). */
    failuresRaw?: string;
    /** Put a directory where the failure-count file should be, so that it cannot be written. */
    failuresUnwritable?: boolean;
    /** The fake check prints no "Health check FAILED" line when it exits 1 (as a crash would). */
    noMarker?: boolean;
    env?: Record<string, string>;
    box?: Sandbox;
  }

  /**
   * `codes` are the exit codes the fake health check returns on its 1st, 2nd, ... run (0 once they run
   * out); `failures` is the failure count already on disk.
   */
  function monitor(
    codes: number[],
    { failures, failuresRaw, failuresUnwritable, noMarker, env = { EMAIL_TO: 'admin@example.com' }, box = sandbox() }: MonitorOptions = {},
  ): Run {
    const project = path.join(box.root, 'project');
    const tsx = path.join(project, 'backend/node_modules/.bin/tsx');
    mkdirSync(path.dirname(tsx), { recursive: true });
    const queue = path.join(box.root, 'tsx-queue');
    writeFileSync(queue, codes.map(String).join('\n') + (codes.length ? '\n' : ''));
    writeFileSync(
      tsx,
      '#!/bin/bash\necho "$*" >> "$TSX_ARGS"\ncode="$(head -n 1 "$TSX_QUEUE")"\ntail -n +2 "$TSX_QUEUE" > "$TSX_QUEUE.next" && mv "$TSX_QUEUE.next" "$TSX_QUEUE"\necho "fake health check output"\nif [ "${code:-0}" = "1" ] && [ -z "$TSX_NO_MARKER" ]; then echo "Health check FAILED." >&2; fi\nexit "${code:-0}"\n',
    );
    chmodSync(tsx, 0o755);
    const fake = (name: string, body: string) => {
      writeFileSync(path.join(box.bin, name), `#!/bin/bash\n${body}\n`);
      chmodSync(path.join(box.bin, name), 0o755);
    };
    // `restart` records the failure count on disk at that moment, and can be made to fail.
    fake('pm2', 'if [ "$1" = "jlist" ]; then echo "[]"; else echo "pm2 $* count=$(cat "$FAILURES_FILE" 2>/dev/null)" >> "$PM2_LOG"; exit "${PM2_RESTART_EXIT:-0}"; fi');
    // The real `timeout` is missing on macOS; this one records its arguments and runs the command.
    fake('timeout', 'echo "timeout $1" >> "$TIMEOUT_LOG"; shift; exec "$@"');
    fake('sleep', 'exit 0');
    fake('curl', 'echo "curl $*" >> "$CURL_LOG"');
    const failuresFile = path.join(box.root, 'health-check-failures');
    if (failuresUnwritable) {
      mkdirSync(failuresFile, { recursive: true });
    } else if (failuresRaw !== undefined) {
      writeFileSync(failuresFile, failuresRaw);
    } else if (failures !== undefined) {
      writeFileSync(failuresFile, `${failures}\n`);
    }

    // Point the script's fixed locations at the sandbox: the project (through an environment variable, so
    // install()'s /tmp rewrite cannot touch a sandbox that itself lives under /tmp) and the optional config
    // file. install() redirects the /var/log and /var/tmp ones (log, failure count, alert state, lock), and
    // the temporary files go to $TMPDIR, which is the sandbox.
    const text = source(SCRIPT)
      .replace('PROJECT_DIR="/root/murphys-laws"', 'PROJECT_DIR="$TEST_PROJECT_DIR"')
      .replace('/etc/default/health-monitor', `${box.root}/no-such-config`);
    const file = install(box, SCRIPT, text);
    const result = runFile(file, [], box, {
      TEST_PROJECT_DIR: project,
      TSX_QUEUE: queue,
      TSX_ARGS: path.join(box.root, 'tsx-args.log'),
      ...(noMarker ? { TSX_NO_MARKER: '1' } : {}),
      PM2_LOG: path.join(box.root, 'pm2.log'),
      FAILURES_FILE: failuresFile,
      TIMEOUT_LOG: path.join(box.root, 'timeout.log'),
      CURL_LOG: path.join(box.root, 'curl.log'),
      TMPDIR: box.root,
      HEALTHCHECKS_PING_URL: 'https://ping.example/uuid',
      ...env,
    });
    const read = (name: string) => readLog(path.join(box.root, name));
    const failuresOnDisk = existsSync(path.join(box.root, 'health-check-failures')) ? read('health-check-failures').trim() : null;
    return {
      status: result.status,
      box,
      tsxArgs: read('tsx-args.log'),
      failures: failuresOnDisk,
      log: read('health-monitor.log'),
      mail: readLog(box.mailLog),
      pm2: read('pm2.log'),
      pings: read('curl.log'),
      timeouts: read('timeout.log'),
    };
  }

  it('is healthy on exit 0: resets the count, pings the dead-man switch, sends nothing', () => {
    const run = monitor([0], { failures: 2 });
    expect(run.status).toBe(0);
    expect(run.failures).toBe('0');
    expect(run.pings).toContain('https://ping.example/uuid');
    expect(run.mail).toBe('');
    expect(run.pm2).toBe('');
  });

  it('runs the health check with --no-email, so this script is the only sender', () => {
    expect(monitor([0]).tsxArgs.trim()).toBe('backend/scripts/health-check.ts --no-email');
  });

  const mails = (run: Run) => (run.mail.match(/ARGS:/g) ?? []).length;
  const stateFile = (run: Run, key: string) => path.join(run.box.root, 'health-monitor-alerts', key);

  it('treats exit 3 (healthy, with warnings) as healthy, and emails the warning once a day at most', () => {
    const first = monitor([3], { failures: 2 });
    expect(first.status).toBe(0);
    expect(first.failures).toBe('0');
    expect(first.pings).toContain('https://ping.example/uuid');
    expect(first.pm2).toBe('');
    expect(first.mail).toContain('Health Check Warning - Performance Degraded');
    expect(first.log).toContain('passed with warnings');

    const again = monitor([3], { box: first.box });
    expect(mails(again)).toBe(1);
    expect(again.log).toContain('ALERT SUPPRESSED (cooldown): Health Check Warning');

    // A day later the warning is due again.
    writeFileSync(stateFile(first, 'warnings'), `${Math.floor(Date.now() / 1000) - 86_500}\n`);
    expect(mails(monitor([3], { box: first.box }))).toBe(2);
  });

  it('does not forget the warning cooldown on a fast run, so a site that flaps does not mail every time', () => {
    const first = monitor([3]);
    monitor([0], { box: first.box });
    expect(existsSync(stateFile(first, 'warnings'))).toBe(true);
    expect(mails(monitor([3], { box: first.box }))).toBe(1);
  });

  it.each([
    ['exit 2 (the check script reported an error)', 2],
    ['exit 4 (the check script failed unexpectedly)', 4],
    ['exit 124 (it timed out)', 124],
    ['exit 127 (tsx, npx or node not found)', 127],
    ['exit 137 (killed)', 137],
  ])('on %s the check could not run: no restart, count untouched, no ping, an alert says so', (_name, code) => {
    const run = monitor([code], { failures: 2 });
    expect(run.status).toBe(2);
    expect(run.failures).toBe('2');
    expect(run.pm2).toBe('');
    expect(run.pings).toBe('');
    expect(run.mail).toContain('Health Check Could Not Run');
    expect(run.mail).toContain(`exit code ${code}`);
    expect(run.log).toContain(`could not run (exit code: ${code},`);
  });

  it('emails "could not run" once per cause every 6 hours, not on every run', () => {
    const first = monitor([2], { failures: 2 });
    expect(mails(first)).toBe(1);

    const again = monitor([2], { box: first.box });
    expect(again.status).toBe(2);
    expect(mails(again)).toBe(1);
    expect(again.log).toContain('ALERT SUPPRESSED (cooldown): Health Check Could Not Run');

    // A different cause is a different problem, so it is reported at once.
    expect(mails(monitor([127], { box: first.box }))).toBe(2);

    // Six hours later the same cause is reported again.
    writeFileSync(stateFile(first, 'could-not-run-2'), `${Math.floor(Date.now() / 1000) - 21_700}\n`);
    expect(mails(monitor([2], { box: first.box }))).toBe(3);
  });

  it('does not start the cooldown when the "could not run" mail was not sent, and keeps it across a healthy run', () => {
    const unsent = monitor([2], { env: {} });
    expect(unsent.log).toContain('ALERT NOT SENT (no recipient configured)');
    expect(existsSync(stateFile(unsent, 'could-not-run-2'))).toBe(false);

    const sent = monitor([2]);
    expect(existsSync(stateFile(sent, 'could-not-run-2'))).toBe(true);
    // A monitor that flaps (a problem, a healthy run, the same problem) mails once, not on every flap.
    monitor([0], { box: sent.box });
    expect(mails(monitor([2], { box: sent.box }))).toBe(1);
  });

  it('keeps the checks and restarts working when the machine has no SMTP settings at all', () => {
    // The check runs with --no-email and the mails go through `mail`, so nothing here needs SMTP.
    const run = monitor([1, 0], { failures: 2, env: { EMAIL_TO: 'admin@example.com', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' } });
    expect(run.status).toBe(0);
    expect(run.pm2).toContain('pm2 restart all');
    expect(run.mail).toContain('Services Restarted Due to Health Check Failures');
  });

  it('treats exit 1 without a "Health check FAILED" line (a crash or a broken install) as a problem with the check, not an outage', () => {
    const run = monitor([1], { failures: 2, noMarker: true });
    expect(run.status).toBe(2);
    expect(run.failures).toBe('2');
    expect(run.pm2).toBe('');
    expect(run.mail).toContain('Health Check Could Not Run');
    expect(run.mail).toContain('crash or a broken install');
  });

  it('runs the check under timeout, with a 120 second backstop', () => {
    expect(monitor([0]).timeouts.trim()).toBe('timeout 120');
  });

  it('says why the check could not run when it timed out', () => {
    expect(monitor([124]).mail).toContain('timed out after 120 seconds');
  });

  it('counts a real failure (exit 1) and alerts, without restarting before the threshold', () => {
    const run = monitor([1]);
    expect(run.status).toBe(1);
    expect(run.failures).toBe('1');
    expect(run.mail).toContain('Health Check Failed (1/3)');
    expect(run.pm2).toBe('');
  });

  it('retries the outage mail on the next failing run when the first one could not be sent, and still reports an outage that ends before the restart', () => {
    // 1st failing run: mail is unavailable (no recipient), so nothing is reported and nothing is marked.
    const first = monitor([1], { env: {} });
    expect(first.log).toContain('ALERT NOT SENT (no recipient configured): Health Check Failed (1/3)');
    expect(mails(first)).toBe(0);
    expect(existsSync(stateFile(first, 'outage-reported'))).toBe(false);

    // 2nd failing run: mail works now, so the outage is reported although failure_count is already 2.
    const second = monitor([1], { box: first.box });
    expect(second.failures).toBe('2');
    expect(mails(second)).toBe(1);
    expect(second.mail).toContain('Health Check Failed (2/3)');
    expect(existsSync(stateFile(first, 'outage-reported'))).toBe(true);

    // 3rd run: the site has recovered before the restart. No restart, and the mark is cleared.
    const third = monitor([0], { box: first.box });
    expect(third.status).toBe(0);
    expect(third.pm2).toBe('');
    expect(mails(third)).toBe(1);
    expect(existsSync(stateFile(first, 'outage-reported'))).toBe(false);

    // A later outage is reported again.
    expect(mails(monitor([1], { box: first.box }))).toBe(2);
  });

  it('emails only the first failure, then the restart, and not the runs in between', () => {
    const first = monitor([1]);
    expect(mails(first)).toBe(1);

    const second = monitor([1], { box: first.box });
    expect(second.failures).toBe('2');
    expect(mails(second)).toBe(1);
    expect(second.log).toContain('ALERT SUPPRESSED (this outage was already emailed)');

    const third = monitor([1, 0], { box: first.box });
    expect(third.pm2).toContain('pm2 restart all');
    expect(mails(third)).toBe(2);
    expect(third.mail).toContain('Services Restarted Due to Health Check Failures');
  });

  it('restarts services on the third failure, and is healthy again when the retest passes', () => {
    const run = monitor([1, 0], { failures: 2 });
    expect(run.status).toBe(0);
    expect(run.pm2).toContain('pm2 restart all');
    expect(run.mail).toContain('Services Restarted Due to Health Check Failures');
    expect(run.failures).toBe('0');
    expect(run.pings).toContain('https://ping.example/uuid');
  });

  it('sends a critical alert and exits 1 when the retest after a restart still fails', () => {
    const run = monitor([1, 1], { failures: 2 });
    expect(run.status).toBe(1);
    expect(run.pm2).toContain('pm2 restart all');
    expect(run.mail).toContain('CRITICAL: Services Still Failing After Restart');
  });

  it('says the check could not run, instead of "still failing", when the retest cannot run', () => {
    const run = monitor([1, 127], { failures: 2 });
    expect(run.status).toBe(2);
    expect(run.mail).toContain('Health Check Could Not Run After Restart');
    expect(run.mail).not.toContain('CRITICAL');
  });

  it('gives the post-restart "could not run" mail its own cooldown, so an earlier "could not run" mail cannot silence it', () => {
    const first = monitor([2]);
    const second = monitor([1, 2], { box: first.box, failures: 2 });
    expect(second.pm2).toContain('pm2 restart all');
    expect(mails(second)).toBe(3);
    expect(second.mail).toContain('Health Check Could Not Run After Restart');
  });

  it('resets the failure count before it restarts, so a run killed during the restart cannot restart again at once', () => {
    expect(monitor([1, 0], { failures: 2 }).pm2).toContain('pm2 restart all count=0');
  });

  it('says so, in the log and the mail, when pm2 restart fails', () => {
    const run = monitor([1, 1], { failures: 2, env: { EMAIL_TO: 'admin@example.com', PM2_RESTART_EXIT: '1' } });
    expect(run.log).toContain('pm2 restart FAILED (exit code: 1)');
    expect(run.mail).toContain('Services Restart FAILED After Health Check Failures');
    expect(run.mail).toContain('the services may still be down');
  });

  it('mails an outage again when the earlier outage mail is older than its 6 hour window', () => {
    const first = monitor([1]);
    expect(mails(monitor([1], { box: first.box }))).toBe(1);
    // The mark left by an outage whose recovery no run ever saw expires on its own.
    writeFileSync(stateFile(first, 'outage-reported'), `${Math.floor(Date.now() / 1000) - 21_700}\n`);
    expect(mails(monitor([1], { box: first.box, failures: 0 }))).toBe(2);
  });

  describe('state files it cannot trust', () => {
    it.each([
      ['a leading zero (an invalid octal number)', '09\n'],
      ['text', 'not a time\n'],
      ['a time in the future (the clock went back)', `${Math.floor(Date.now() / 1000) + 86_400}\n`],
    ])('treats a cooldown file holding %s as due, and finishes normally', (_name, content) => {
      const first = monitor([0]);
      mkdirSync(path.dirname(stateFile(first, 'x')), { recursive: true });
      writeFileSync(stateFile(first, 'could-not-run-2'), content);
      const run = monitor([2], { box: first.box });
      expect(run.status).toBe(2);
      expect(mails(run)).toBe(1);
      expect(run.mail).toContain('Health Check Could Not Run');
    });

    it('counts from 0 when the failure-count file holds something that is not a number', () => {
      expect(monitor([1], { failuresRaw: '1 2\n' }).failures).toBe('1');
    });

    it('says so, and mails once, when it cannot save the failure count (it could never reach the restart threshold)', () => {
      const run = monitor([1], { failuresUnwritable: true });
      expect(run.log).toContain('could not save the failure count');
      expect(run.mail).toContain('Health Monitor Cannot Save Its State');
      expect(run.pm2).toBe('');
    });
  });

  describe('one run at a time, and no leftovers', () => {
    const lockDir = (box: Sandbox) => path.join(box.root, 'health-monitor.lock');
    const holdLock = (box: Sandbox, pid: number, startedSecondsAgo: number) => {
      mkdirSync(lockDir(box), { recursive: true });
      writeFileSync(path.join(lockDir(box), 'pid'), `${pid}\n`);
      writeFileSync(path.join(lockDir(box), 'started'), `${Math.floor(Date.now() / 1000) - startedSecondsAgo}\n`);
    };

    it('skips the run, without checking anything, while another run is still in progress', () => {
      const box = sandbox();
      holdLock(box, process.pid, 5); // this test process is alive
      const run = monitor([1], { box });
      expect(run.status).toBe(0);
      expect(run.log).toContain(`Another health monitor run (pid ${process.pid}) is still in progress`);
      expect(run.tsxArgs).toBe('');
      expect(existsSync(lockDir(box))).toBe(true);
    });

    it.each([
      ['its owner is gone', 2_147_483_646, 5],
      ['it is older than 15 minutes, even if its owner exists', process.pid, 2_000],
    ])('takes over a lock when %s, and releases it afterwards', (_name, pid, age) => {
      const box = sandbox();
      holdLock(box, pid, age);
      const run = monitor([0], { box });
      expect(run.status).toBe(0);
      expect(run.log).toContain('Taking over a stale health monitor lock');
      expect(run.tsxArgs).not.toBe('');
      expect(existsSync(lockDir(box))).toBe(false);
    });

    it('leaves no lock and no temporary file behind, however the run ends', () => {
      for (const codes of [[0], [3], [2], [1], [1, 0]]) {
        const box = sandbox();
        monitor(codes, { box, failures: codes.length > 1 ? 2 : undefined });
        expect(existsSync(lockDir(box)), `lock after ${codes}`).toBe(false);
        expect(readdirSync(box.root).filter((name) => /^health-monitor\.[A-Za-z0-9]{6}$/.test(name)), `temp files after ${codes}`).toEqual([]);
      }
    });
  });

  it('exits 2, so cron notices, when the restart alert could not be delivered although the retest passed', () => {
    const run = monitor([1, 0], { failures: 2, env: {} });
    expect(run.status).toBe(2);
    expect(run.log).toContain('ALERT NOT SENT (no recipient configured)');
  });
});

describe('scripts run end to end with a fake mail', () => {
  it('cost-optimization-report.sh (set -euo pipefail) emails the report, and says so when there is no recipient or mail fails', () => {
    const run = (box: Sandbox, args: string[], env: Record<string, string> = {}) => {
      // The script reads host state (memory, load, cores); fixed answers make macOS and Linux behave alike.
      const fake = (name: string, body: string) => {
        writeFileSync(path.join(box.bin, name), `#!/bin/bash\n${body}\n`);
        chmodSync(path.join(box.bin, name), 0o755);
      };
      fake('free', 'if [ "$2" = "-m" ] || [ "$1" = "-m" ]; then echo "              total        used        free      shared  buff/cache   available"; echo "Mem:           1000         400         100           0         500         600"; echo "Swap:             0           0           0"; fi');
      fake('nproc', 'echo 2');
      fake('uptime', 'echo " 10:00:00 up 1 day,  1 user,  load average: 0.50, 0.40, 0.30"');
      fake('bc', 'cat >/dev/null; echo 10.0');
      const file = install(box, 'cost-optimization-report.sh', source('cost-optimization-report.sh'));
      return runFile(file, args, box, {
        METRICS_DIR: path.join(box.root, 'metrics'),
        INVENTORY_FILE: path.join(box.root, 'no-inventory.json'),
        ...env,
      });
    };

    const sent = sandbox();
    const ok = run(sent, [], { EMAIL_TO: 'admin@example.com' });
    expect(ok.status).toBe(0);
    expect(ok.stderr).toContain('Report emailed to admin@example.com');
    expect(readLog(sent.mailLog)).toContain(
      "ARG<-s>\nARG<[Murphy's Laws] Monthly Cost Optimization Report>\nARG<-->\nARG<admin@example.com>\n",
    );

    const suppressed = sandbox();
    expect(run(suppressed, ['--no-email'], { EMAIL_TO: 'admin@example.com' }).status).toBe(0);
    expect(readLog(suppressed.mailLog)).toBe('');

    const dropped = sandbox();
    const noRecipient = run(dropped, []);
    // Nothing could be delivered, so cron is told with exit code 2.
    expect(noRecipient.status).toBe(2);
    expect(noRecipient.stderr).toContain('Report NOT emailed (no recipient configured)');

    const failing = sandbox();
    const failed = run(failing, [], { EMAIL_TO: 'admin@example.com', MAIL_EXIT: '1' });
    expect(failed.status).toBe(2);
    expect(failed.stderr).toContain('Report NOT emailed (mail exited with status 1)');
  }, 60_000); // runs the whole script four times

  it('test-backup-restore.sh emails its report, and says so when it could not', () => {
    const run = (box: Sandbox, env: Record<string, string> = {}) => {
      // Point the script at an empty sandbox instead of the host's real /root/backups and database.
      const text = source('test-backup-restore.sh')
        .replaceAll('/root/backups/', `${box.root}/backups/`)
        .replaceAll('/root/murphys-laws/backend/murphys.db', `${box.root}/murphys.db`);
      const file = install(box, 'test-backup-restore.sh', text);
      return runFile(file, [], box, env);
    };
    const log = (box: Sandbox) => readLog(path.join(box.root, 'backup-restore-test.log')) || '';

    const sent = sandbox();
    const result = run(sent, { EMAIL_TO: 'admin@example.com' });
    expect(readLog(sent.mailLog)).toContain('-s [Murphy\'s Laws] Backup Restore Test');
    expect(readLog(sent.mailLog)).toContain('-- admin@example.com');
    expect(readLog(sent.mailLog)).toContain('FAIL: No database backup found');
    // The exit code is the test result (no backups exist here, so it failed), never the mail result.
    expect(result.status).toBe(1);

    const dropped = sandbox();
    const noRecipient = run(dropped);
    expect(readLog(dropped.mailLog)).toBe('');
    expect(`${noRecipient.stdout}${noRecipient.stderr}${log(dropped)}`).toContain('Report NOT emailed (no recipient configured)');
    expect(noRecipient.status).toBe(1);
  });

  // The first law (lowest id) is what the sample line shows. A second, titled law is inserted first so the
  // test also fails if the ORDER BY or the COALESCE arguments are removed or swapped.
  it.each([
    ['has no title', null, 'Radio clocks never go off.', 'Radio clocks never go off.'],
    ['has an empty title', '', 'Radio clocks never go off.', 'Radio clocks never go off.'],
    ['has a title', 'Elevator law', 'The last man in goes to the lowest floor.', 'Elevator law'],
    ['has very long text and no title', null, 'x'.repeat(300), 'x'.repeat(120)],
    ['has a newline in its text', null, 'First line\nsecond line', 'First line second line'],
    ['has a carriage return and newline in its title', 'Title\r\nsplit', 'Unused text', 'Title  split'],
    ['has a newline just before the 120-character cut', null, `${'y'.repeat(119)}\nz`, `${'y'.repeat(119)} `],
  ])('test-backup-restore.sh names a sample law when the first law %s', (_case, title, lawText, expected) => {
    // The script shells out to the real sqlite3 CLI; fail with a clear reason if a machine lacks it.
    expect(existsSync('/usr/bin/sqlite3'), 'the sqlite3 CLI must be installed at /usr/bin/sqlite3').toBe(true);

    const box = sandbox();
    mkdirSync(path.join(box.root, 'backups'));
    const backup = path.join(box.root, 'backups', 'murphys_db_20260101_000000.db');
    const db = new Database(backup);
    try {
      db.exec('CREATE TABLE laws (id INTEGER PRIMARY KEY, title TEXT, text TEXT NOT NULL)');
      db.prepare('INSERT INTO laws (id, title, text) VALUES (?, ?, ?)').run(2, 'Second law', 'Second law text');
      db.prepare('INSERT INTO laws (id, title, text) VALUES (?, ?, ?)').run(1, title, lawText);
    } finally {
      db.close();
    }
    // The script compares the backup's row count with the production database's, so give it one.
    copyFileSync(backup, path.join(box.root, 'murphys.db'));

    const text = source('test-backup-restore.sh')
      .replaceAll('/root/backups/', `${box.root}/backups/`)
      .replaceAll('/root/murphys-laws/backend/murphys.db', `${box.root}/murphys.db`);
    const result = runFile(install(box, 'test-backup-restore.sh', text), [], box, { EMAIL_TO: 'admin@example.com' });

    expect(result.stdout).not.toContain('FAIL: Cannot query');
    expect(result.stdout).toContain('PASS: Can query restored database');
    expect(result.stdout).toContain(`Sample law: ${expected}\n`);
  });
});

describe('deploy wiring', () => {
  const targets = [
    ['the GitHub workflow', root('.github/workflows/deploy.yml')],
    ['npm run deploy (deploy.ts)', path.join(scriptsDir, 'deploy.ts')],
  ] as const;
  // Scripts that source the helper and are installed individually (health-check.sh is run from the repo).
  const installed = MAILING_SCRIPTS.filter((script) => script !== 'health-check.sh');

  describe.each(targets)('%s', (_label, file) => {
    const lines = readFileSync(file, 'utf8').split('\n');
    const copiesHelper = (line: string) => line.includes('alert-email.sh') && line.includes('cp ');
    // The line that installs a script: its own cp line, or the workflow's `for script in ...` loop.
    // (the last match: the workflow also names these scripts in an earlier check that they were uploaded)
    const installLine = (name: string) =>
      lines.reduce(
        (found, line, index) =>
          (line.includes(`/${name}`) && line.includes('cp ')) ||
          (line.includes('for script in') && line.includes(name.replace('.sh', '')))
            ? index
            : found,
        -1,
      );

    it('installs the helper into /usr/local/bin on an earlier line than every script that sources it', () => {
      const helperLine = lines.findIndex(copiesHelper);
      expect(helperLine).toBeGreaterThan(-1);
      for (const name of installed) {
        const line = installLine(name);
        expect(line, `${name} is installed`).toBeGreaterThan(-1);
        expect(line, `${name} comes after the helper`).toBeGreaterThan(helperLine);
      }
    });

    it('does not hide a failed install of the helper or of any script that now loads it', () => {
      const installing = lines.filter(
        (line) =>
          (line.includes('cp ') && (copiesHelper(line) || line.includes('$script.sh'))) ||
          installed.some((name) => line.includes('cp ') && line.includes(`/${name}`)),
      );
      expect(installing.length).toBeGreaterThanOrEqual(2);
      for (const line of installing) {
        expect(line).not.toContain('|| true');
        expect(line).not.toContain('2>/dev/null');
      }
    });
  });

  const workflow = () => readFileSync(root('.github/workflows/deploy.yml'), 'utf8');

  /** The `run: |` script of a workflow step, de-indented, found by the step's name. */
  const stepScript = (name: string): string => {
    const lines = workflow().split('\n');
    const start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
    expect(start, `step "${name}" exists`).toBeGreaterThan(-1);
    const runAt = lines.findIndex((line, index) => index > start && line.trim() === 'run: |');
    expect(runAt, `step "${name}" has a run script`).toBeGreaterThan(-1);
    const indent = lines[runAt + 1].length - lines[runAt + 1].trimStart().length;
    const body: string[] = [];
    for (let index = runAt + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() !== '' && line.length - line.trimStart().length < indent) {
        break;
      }
      body.push(line.slice(indent));
    }
    return `${body.join('\n')}\n`;
  };

  it('the workflow stops the deploy, with a message, when the helper cannot be installed', () => {
    const deploy = workflow();
    expect(deploy).toMatch(/alert-email\.sh[^\n]*\\\n[^\n]*chmod \+x \/usr\/local\/bin\/alert-email\.sh[^\n]*\\\n[^\n]*test -f \/usr\/local\/bin\/alert-email\.sh[^\n]*\\\n[^\n]*exit 1/);
    expect(deploy).toContain('could not install /usr/local/bin/alert-email.sh');
  });

  it('the workflow stops the deploy when a monitoring script cannot be installed', () => {
    const deploy = workflow();
    expect(deploy).toMatch(/for script in [^\n]*; do\n[^\n]*cp [^\n]*\\\n[^\n]*chmod \+x [^\n]*\\\n[^\n]*exit 1[^\n]*\n\s*done/);
  });

  describe('the early "Check monitoring recipient secrets" step, run for real', () => {
    const check = (env: Record<string, string>) => {
      const box = sandbox();
      const file = path.join(box.root, 'check.sh');
      writeFileSync(file, stepScript('Check monitoring recipient secrets'));
      return runFile(file, [], box, env);
    };

    it.each([
      ['both set', { ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' }],
      ['only ALERT_EMAIL set', { ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: '' }],
      ['only EMAIL_TO set', { ALERT_EMAIL: '', EMAIL_TO: 'admin@example.com' }],
    ])('lets the deploy continue when %s', (_name, env) => {
      expect(check(env).status).toBe(0);
    });

    it.each([
      ['both empty', { ALERT_EMAIL: '', EMAIL_TO: '' }],
      ['both whitespace-only', { ALERT_EMAIL: '  ', EMAIL_TO: '\n' }],
    ])('stops the deploy with an error annotation when %s', (_name, env) => {
      const result = check(env);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('::error::');
    });

    it('runs before anything is uploaded to the server', () => {
      const deploy = workflow();
      expect(deploy.indexOf('- name: Check monitoring recipient secrets')).toBeLessThan(deploy.indexOf('- name: Upload build artifacts'));
    });
  });

  it('the server script checks that the monitoring scripts arrived before it changes anything live', () => {
    const deploy = workflow();
    const preflight = deploy.indexOf('is missing from the uploaded release');
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(deploy.indexOf('sudo rsync -a --delete "$STAGING_DIR/web/dist/"'));
  });

  it('npm run deploy checks its scripts exist before the first sync', () => {
    const text = readFileSync(path.join(scriptsDir, 'deploy.ts'), 'utf8');
    expect(text.indexOf('nothing was changed on the server')).toBeGreaterThan(-1);
    expect(text.indexOf('nothing was changed on the server')).toBeLessThan(text.indexOf('Syncing web dist folder'));
  });

  it('the workflow writes the recipient secrets to the server .env, and the cleanup removes only the empty optional ones', () => {
    const deploy = workflow();
    expect(deploy).toContain("EMAIL_TO=${{ secrets['EMAIL_TO'] }}");
    expect(deploy).toContain("ALERT_EMAIL=${{ secrets['ALERT_EMAIL'] }}");
    expect(deploy).toContain("HEALTH_CHECK_EMAIL_TO=${{ secrets['HEALTH_CHECK_EMAIL_TO'] }}");

    // Run the cleanup's own sed expressions (the workflow uses GNU `sed -i`; here they filter stdin).
    const cleanup = deploy.match(/sed -i (-e '[^']+' )+\.env/);
    expect(cleanup, 'the sed cleanup is in the workflow').not.toBeNull();
    const expressions = cleanup![0].replace(/^sed -i /, '').replace(/ \.env$/, '');
    const box = sandbox();
    const input = path.join(box.root, 'in.env');
    writeFileSync(input, 'EMAIL_TO=\nALERT_EMAIL=\nHEALTH_CHECK_EMAIL_TO=\nSMTP_HOST=smtp.example.com\n');
    const file = path.join(box.root, 'cleanup.sh');
    writeFileSync(file, `sed ${expressions} < "$ENV_IN"\n`);
    expect(runFile(file, [], box, { ENV_IN: input }).stdout).toBe('EMAIL_TO=\nSMTP_HOST=smtp.example.com\n');

    writeFileSync(input, 'EMAIL_TO=admin@example.com\nALERT_EMAIL=alerts@example.com\nHEALTH_CHECK_EMAIL_TO=h@example.com\n');
    expect(runFile(file, [], box, { ENV_IN: input }).stdout).toBe('EMAIL_TO=admin@example.com\nALERT_EMAIL=alerts@example.com\nHEALTH_CHECK_EMAIL_TO=h@example.com\n');
  });

  it('installs tsx where health-monitor.sh looks for it: a runtime dependency, installed by npm ci without --omit=dev', () => {
    const backendPackage = JSON.parse(readFileSync(path.join(scriptsDir, '../package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(backendPackage.dependencies).toHaveProperty('tsx');
    expect(source('health-monitor.sh')).toContain('backend/node_modules/.bin/tsx');
    const installs = [workflow(), readFileSync(path.join(scriptsDir, 'deploy.ts'), 'utf8')].join('\n').split('\n').filter((line) => /npm (ci|install)/.test(line));
    expect(installs.length).toBeGreaterThan(0);
    for (const line of installs) {
      expect(line).not.toMatch(/--omit=dev|--production/);
    }
  });
});

describe('the scripts themselves', () => {
  it.each(MAILING_SCRIPTS)('%s uses the shared helper, never calls mail directly, and has valid syntax', (name) => {
    const text = source(name);
    expect(text).toContain('source "$_alert_helper"');
    expect(text).toContain('FATAL: cannot load alert-email.sh');
    expect(text).toMatch(/ALERT_EMAIL="\$\(resolve_alert_email[^)]*\)"/);
    expect(text).toMatch(/send_alert_mail /);
    expect(text).not.toMatch(/\bmail -s/);
    const box = sandbox();
    expect(bash(`bash -n "$SCRIPT_UNDER_TEST"`, box, { SCRIPT_UNDER_TEST: path.join(scriptsDir, name) }).status).toBe(0);
  });

  // Structure checks. The behavior itself is tested above (the state, exit-code and flow tests); these only
  // catch a script that grows an exit path which would skip the delivery check.
  // `exit 0` before any mail can have been sent is fine: --json mode in the cost report, the healthy path
  // (health-monitor.sh's is skipping a run because another one holds the lock).
  it.each([
    ['cost-optimization-report.sh', 1],
    ['health-check.sh', 0],
    ['health-monitor.sh', 1],
    ['ssl-monitor.sh', 0],
    ['test-backup-restore.sh', 0],
  ])('%s: every exit is a failure code or goes through delivery_exit_code (%i plain exit 0 allowed)', (name, plainZero) => {
    const exits = source(name)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^exit\b/.test(line));
    const unchecked = exits.filter((line) => !/^exit [12]$/.test(line) && !line.includes('delivery_exit_code'));
    expect(unchecked.filter((line) => line !== 'exit 0')).toEqual([]);
    expect(unchecked.filter((line) => line === 'exit 0')).toHaveLength(plainZero);
    expect(exits.some((line) => line.includes('delivery_exit_code'))).toBe(true);
  });

  it.each(MAILING_SCRIPTS)('%s: every "not sent" log line is followed by ALERT_UNDELIVERED=1', (name) => {
    const lines = source(name).split('\n');
    const notSent = lines.flatMap((line, index) => (/NOT SENT \(|NOT emailed \(/.test(line) ? [index] : []));
    expect(notSent.length).toBeGreaterThan(0);
    for (const index of notSent) {
      expect(lines[index + 1], `${name}:${index + 1}`).toContain('ALERT_UNDELIVERED=1');
    }
  });

  it('vulnerability-scanner.sh sends no mail and loads no mail helper (the daily report mails its output)', () => {
    const text = source('vulnerability-scanner.sh');
    expect(text).not.toMatch(/\bmail\b|ALERT_EMAIL|alert-email/);
  });

  it('no script or source file hard-codes an email address, other than example addresses and the site\'s own', () => {
    const backendRoot = path.resolve(scriptsDir, '..');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.(sh|ts|mjs|js)$/.test(entry.name) ? [path.join(dir, entry.name)] : [],
      );
    const allowed = /@(example\.(com|org)|murphys-laws\.com)$/i;
    const offenders: string[] = [];
    for (const file of [...walk(scriptsDir), ...walk(path.join(backendRoot, 'src'))]) {
      for (const address of readFileSync(file, 'utf8').match(/[\w.+-]+@[\w-]+(\.[\w-]+)*\.[a-z]{2,}/gi) ?? []) {
        if (!allowed.test(address)) {
          offenders.push(`${path.relative(backendRoot, file)}: ${address}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
