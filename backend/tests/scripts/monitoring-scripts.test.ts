import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
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

const MAILING_SCRIPTS = [
  'cost-optimization-report.sh',
  'health-check.sh',
  'health-monitor.sh',
  'ssl-monitor.sh',
  'test-backup-restore.sh',
  'vulnerability-scanner.sh',
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
    // The script runs with TZ=UTC (see runFile), so its date matches this one.
    const stateFile = stateTemplate.replace('<today>', new Date().toISOString().slice(0, 10));
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
      expect(existsSync(path.join(box.root, stateFile))).toBe(true);

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
      expect(existsSync(path.join(box.root, stateFile))).toBe(false);

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
      expect(existsSync(path.join(box.root, stateFile))).toBe(false);
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
      expect(source('health-monitor.sh')).not.toContain('Services restarted. Alert sent.');
    });

    it('runs a health check script that exists, and keeps a configuration error out of the restart count', () => {
      const text = source('health-monitor.sh');
      expect(text).not.toContain('health-check.mjs');
      expect(text).toContain('backend/scripts/health-check.ts');
      expect(existsSync(path.join(scriptsDir, 'health-check.ts'))).toBe(true);
      expect(text).toMatch(/health_check_exit_code" -eq 2 \]/);
    });
  });

  describe('vulnerability-scanner.sh send_report', () => {
    const run = (box: Sandbox, env: Record<string, string> = {}) => {
      writeFileSync(path.join(box.root, 'report.txt'), 'report body\n');
      const file = install(
        box,
        'vulnerability-scanner.sh',
        `${throughFunction('vulnerability-scanner.sh', 'send_report')}send_report "Weekly scan" "${'$REPORT_PATH'}"; echo "done"\n`,
      );
      return runFile(file, [], box, { REPORT_PATH: path.join(box.root, 'report.txt'), ...env });
    };
    const log = (box: Sandbox) => readLog(path.join(box.root, 'vulnerability-scanner.log'));

    it('mails the report and logs it, or says plainly that it was not emailed', () => {
      const sent = sandbox();
      run(sent, { EMAIL_TO: 'admin@example.com' });
      expect(readLog(sent.mailLog)).toContain('report body');
      expect(log(sent)).toContain('Report emailed to admin@example.com');

      const dropped = sandbox();
      run(dropped);
      expect(log(dropped)).toContain('Report NOT emailed (no recipient configured)');
      expect(log(dropped)).not.toContain('Report emailed to');
    });
  });
});

describe('scripts run end to end with a fake mail', () => {
  it('cost-optimization-report.sh (set -euo pipefail) emails the report, and survives a missing or failing mail', () => {
    const run = (box: Sandbox, args: string[], env: Record<string, string> = {}) => {
      const file = install(box, 'cost-optimization-report.sh', source('cost-optimization-report.sh'));
      return runFile(file, args, box, { METRICS_DIR: path.join(box.root, 'metrics'), ...env });
    };

    const sent = sandbox();
    const ok = run(sent, [], { EMAIL_TO: 'admin@example.com' });
    expect(ok.status).toBe(0);
    expect(ok.stderr).toContain('Report emailed to admin@example.com');
    expect(readLog(sent.mailLog)).toContain('ARGS: -s [Murphy\'s Laws] Monthly Cost Optimization Report -- admin@example.com');

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
    const installLine = (name: string) =>
      lines.findIndex(
        (line) =>
          (line.includes(`/${name}`) && line.includes('cp ')) ||
          (line.includes('for script in') && line.includes(name.replace('.sh', ''))),
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

  it('the workflow stops the deploy, with a message, when the helper cannot be installed', () => {
    const deploy = workflow();
    expect(deploy).toMatch(/alert-email\.sh[^\n]*\\\n[^\n]*chmod \+x \/usr\/local\/bin\/alert-email\.sh[^\n]*\\\n[^\n]*test -f \/usr\/local\/bin\/alert-email\.sh[^\n]*\\\n[^\n]*exit 1/);
    expect(deploy).toContain('could not install /usr/local/bin/alert-email.sh');
  });

  it('the workflow stops the deploy when a monitoring script cannot be installed', () => {
    const deploy = workflow();
    expect(deploy).toMatch(/for script in [^\n]*; do\n[^\n]*cp [^\n]*\\\n[^\n]*chmod \+x [^\n]*\\\n[^\n]*exit 1[^\n]*\n\s*done/);
  });

  it('the workflow refuses to deploy before overwriting .env when neither recipient secret is set', () => {
    const deploy = workflow();
    const guard = deploy.indexOf("secrets['ALERT_EMAIL'] == '' && secrets['EMAIL_TO'] == ''");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(deploy.indexOf('cat > .env'));
    expect(deploy.slice(guard, deploy.indexOf('cat > .env'))).toContain('exit 1');
  });

  it('the workflow passes the recipient secrets to the server .env and leaves the optional ones out when unset', () => {
    const deploy = workflow();
    expect(deploy).toContain("ALERT_EMAIL=${{ secrets['ALERT_EMAIL'] }}");
    expect(deploy).toContain("HEALTH_CHECK_EMAIL_TO=${{ secrets['HEALTH_CHECK_EMAIL_TO'] }}");
    expect(deploy).toContain("sed -i -e '/^ALERT_EMAIL=$/d' -e '/^HEALTH_CHECK_EMAIL_TO=$/d' .env");
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

  it.each([
    'cost-optimization-report.sh',
    'health-check.sh',
    'health-monitor.sh',
    'ssl-monitor.sh',
    'test-backup-restore.sh',
  ])('%s records an undelivered alert and ends with delivery_exit_code', (name) => {
    const text = source(name);
    expect(text).toContain('ALERT_UNDELIVERED=1');
    expect(text).toContain('delivery_exit_code');
  });

  it('no script in the repo hard-codes an email recipient', () => {
    const shell = readdirSync(scriptsDir).filter((file) => file.endsWith('.sh') || file.endsWith('.ts'));
    for (const file of shell) {
      const text = readFileSync(path.join(scriptsDir, file), 'utf8');
      expect(text, file).not.toMatch(/ALERT_EMAIL="[^$"][^"]*@/);
      expect(text, file).not.toMatch(/[\w.+-]+@gmail\.com/);
    }
  });
});
