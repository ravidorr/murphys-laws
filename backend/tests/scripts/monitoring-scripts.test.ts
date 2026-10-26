import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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
    failures: string | null;
    log: string;
    mail: string;
    pm2: string;
    pings: string;
  }

  /**
   * `codes` are the exit codes the fake health check returns on its 1st, 2nd, ... run (0 once they run
   * out); `failures` is the failure count already on disk.
   */
  function monitor(codes: number[], { failures, env = { EMAIL_TO: 'admin@example.com' } }: { failures?: number; env?: Record<string, string> } = {}): Run {
    const box = sandbox();
    const project = path.join(box.root, 'project');
    const tsx = path.join(project, 'backend/node_modules/.bin/tsx');
    mkdirSync(path.dirname(tsx), { recursive: true });
    const queue = path.join(box.root, 'tsx-queue');
    writeFileSync(queue, codes.map(String).join('\n') + (codes.length ? '\n' : ''));
    writeFileSync(
      tsx,
      '#!/bin/bash\ncode="$(head -n 1 "$TSX_QUEUE")"\ntail -n +2 "$TSX_QUEUE" > "$TSX_QUEUE.next" && mv "$TSX_QUEUE.next" "$TSX_QUEUE"\necho "fake health check output"\nexit "${code:-0}"\n',
    );
    chmodSync(tsx, 0o755);
    const fake = (name: string, body: string) => {
      writeFileSync(path.join(box.bin, name), `#!/bin/bash\n${body}\n`);
      chmodSync(path.join(box.bin, name), 0o755);
    };
    fake('pm2', 'if [ "$1" = "jlist" ]; then echo "[]"; else echo "pm2 $*" >> "$PM2_LOG"; fi');
    fake('sleep', 'exit 0');
    fake('curl', 'echo "curl $*" >> "$CURL_LOG"');
    if (failures !== undefined) {
      writeFileSync(path.join(box.root, 'health-check-failures'), `${failures}\n`);
    }

    // Point the script's fixed locations at the sandbox: the project (through an environment variable, so
    // install()'s /tmp rewrite cannot touch a sandbox that itself lives under /tmp), the output files
    // under /tmp, and the optional config file. install() redirects the /var/log and /var/tmp ones.
    const text = source(SCRIPT)
      .replace('PROJECT_DIR="/root/murphys-laws"', 'PROJECT_DIR="$TEST_PROJECT_DIR"')
      // (not the /var/tmp state file, which install() redirects itself)
      .replace(/(?<!\/var)\/tmp\/health-check-/g, `${box.root}/health-check-`)
      .replace('/etc/default/health-monitor', `${box.root}/no-such-config`);
    const file = install(box, SCRIPT, text);
    const result = runFile(file, [], box, {
      TEST_PROJECT_DIR: project,
      TSX_QUEUE: queue,
      PM2_LOG: path.join(box.root, 'pm2.log'),
      CURL_LOG: path.join(box.root, 'curl.log'),
      HEALTHCHECKS_PING_URL: 'https://ping.example/uuid',
      ...env,
    });
    const read = (name: string) => readLog(path.join(box.root, name));
    const failuresOnDisk = existsSync(path.join(box.root, 'health-check-failures')) ? read('health-check-failures').trim() : null;
    return {
      status: result.status,
      box,
      failures: failuresOnDisk,
      log: read('health-monitor.log'),
      mail: readLog(box.mailLog),
      pm2: read('pm2.log'),
      pings: read('curl.log'),
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

  it('treats exit 3 (only warnings, and the check could not email them) as healthy, but logs it', () => {
    const run = monitor([3], { failures: 2 });
    expect(run.status).toBe(0);
    expect(run.failures).toBe('0');
    expect(run.pings).toContain('https://ping.example/uuid');
    expect(run.log).toContain('could not deliver its own alert email');
    expect(run.pm2).toBe('');
  });

  it.each([
    ['exit 2 (misconfigured)', 2],
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
    expect(run.log).toContain(`could not run (exit code: ${code})`);
  });

  it('counts a real failure (exit 1) and alerts, without restarting before the threshold', () => {
    const run = monitor([1]);
    expect(run.status).toBe(1);
    expect(run.failures).toBe('1');
    expect(run.mail).toContain('Health Check Failed (1/3)');
    expect(run.pm2).toBe('');
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
  });

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
  // in health-monitor.sh (it only mails on failures).
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
