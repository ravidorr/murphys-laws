import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { scratchDir } from '../helpers/shell-sandbox.ts';
import {
  ADMIN_UI_PATH,
  buildAdminUrl,
  buildPendingApprovalsSection,
  collectDailyReport,
  countPendingApprovals,
  loadConfigFromEnvFiles,
  reportRecipient,
  runCli,
  logCollectorError,
  offsiteBackupItem,
  parseOffsiteBackupStatus,
  parsePm2Jlist,
  renderHtmlReport,
  renderPlainTextReport,
} from '../../scripts/render-daily-report.ts';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(execFileSync).mockReset();
});

const json = '[{"name":"murphys-api","pm2_env":{"status":"online","restart_time":1}}]';

describe('parsePm2Jlist', () => {
  it('parses clean JSON output', () => {
    expect(parsePm2Jlist(json)[0].name).toBe('murphys-api');
  });

  it('skips the out-of-date banner pm2 prints before the JSON', () => {
    const banner = '\n>>>> In-memory PM2 is out-of-date, do:\n>>>> $ pm2 update\nIn memory PM2 version: 7.0.4\nLocal PM2 version: 6.0.13\n\n';
    expect(parsePm2Jlist(banner + json)[0].pm2_env?.status).toBe('online');
  });

  it('skips [PM2] diagnostics printed when the daemon has to be spawned', () => {
    const diagnostics = '[PM2] Spawning PM2 daemon with pm2_home=/root/.pm2\n[PM2] PM2 Successfully daemonized\n';
    expect(parsePm2Jlist(diagnostics + json)[0].name).toBe('murphys-api');
  });

  it('parses an empty process list after diagnostics', () => {
    expect(parsePm2Jlist('[PM2] Spawning PM2 daemon\n[]')).toEqual([]);
  });

  it('throws when no JSON is present', () => {
    expect(() => parsePm2Jlist('nothing here')).toThrow('no JSON');
  });
});

describe('logCollectorError', () => {
  it('writes the collector name and error message to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    logCollectorError('log analysis', new Error('boom'));
    expect(write).toHaveBeenCalledWith('[daily-report] log analysis failed: boom\n');
    write.mockRestore();
  });

  it('stringifies non-Error values', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    logCollectorError('PM2 status', 'plain failure');
    expect(write).toHaveBeenCalledWith('[daily-report] PM2 status failed: plain failure\n');
    write.mockRestore();
  });
});

describe('collectDailyReport collector failures', () => {
  it('logs the failing collectors instead of swallowing them', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('command unavailable');
    });
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const repoRoot = scratchDir('daily-report-');
    // Sunday the 1st exercises the weekly and monthly collectors too.
    collectDailyReport({ repoRoot, now: new Date(Date.UTC(2026, 1, 1)) });
    const logged = write.mock.calls.map(([chunk]) => String(chunk));
    write.mockRestore();
    vi.mocked(execFileSync).mockReset();
    for (const collector of ['log analysis', 'vulnerability scan', 'cost optimization report']) {
      expect(logged).toContain(`[daily-report] ${collector} failed: command unavailable\n`);
    }
  });
});

describe('buildAdminUrl', () => {
  it('links to the /admin page', () => {
    expect(ADMIN_UI_PATH).toBe('/admin');
    expect(buildAdminUrl({ BASE_URL: 'https://staging.example.com' })).toBe('https://staging.example.com/admin');
    expect(buildAdminUrl({})).toBe('https://murphys-laws.com/admin');
  });

  it('uses the configured base URL and trims trailing slashes', () => {
    expect(buildAdminUrl({ BASE_URL: 'https://staging.example.com//' })).toBe(
      `https://staging.example.com${ADMIN_UI_PATH}`,
    );
  });

  it('falls back to the site URL when BASE_URL is unset or blank', () => {
    expect(buildAdminUrl({})).toBe(`https://murphys-laws.com${ADMIN_UI_PATH}`);
    expect(buildAdminUrl({ BASE_URL: '  ' })).toBe(`https://murphys-laws.com${ADMIN_UI_PATH}`);
  });

  it('defaults to process.env', () => {
    vi.stubEnv('BASE_URL', 'https://env.example.com');
    expect(buildAdminUrl()).toBe(`https://env.example.com${ADMIN_UI_PATH}`);
  });

  it('keeps a base path', () => {
    expect(buildAdminUrl({ BASE_URL: 'https://example.com/app/' })).toBe(`https://example.com/app${ADMIN_UI_PATH}`);
  });

  it.each([
    'murphys-laws.com',
    'javascript:alert(1)',
    'https://',
    'https://example.com?tenant=x',
    'https://example.com/#frag',
  ])(
    'ignores and logs a BASE_URL that is not a plain http(s) URL (%s)',
    (BASE_URL) => {
      const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      expect(buildAdminUrl({ BASE_URL })).toBe(`https://murphys-laws.com${ADMIN_UI_PATH}`);
      expect(String(write.mock.calls[0]?.[0])).toContain('[daily-report] admin link failed');
    },
  );
});

describe('countPendingApprovals', () => {
  it('returns the count reported by sqlite3', () => {
    vi.mocked(execFileSync).mockReturnValue('7\n');
    expect(countPendingApprovals('/db')).toBe(7);
    expect(vi.mocked(execFileSync).mock.calls.at(-1)?.[1]).toEqual([
      '/db',
      "SELECT COUNT(*) FROM laws WHERE status='in_review';",
    ]);
    vi.mocked(execFileSync).mockReset();
  });

  it('logs and returns null when sqlite3 fails', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('database is locked');
    });
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(countPendingApprovals('/db')).toBeNull();
    expect(write).toHaveBeenCalledWith('[daily-report] pending approvals count failed: database is locked\n');
    write.mockRestore();
    vi.mocked(execFileSync).mockReset();
  });

  it('includes sqlite3 stderr and applies a timeout', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw Object.assign(new Error('Command failed: sqlite3'), { stderr: Buffer.from('database is locked\n') });
    });
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(countPendingApprovals('/db')).toBeNull();
    expect(write).toHaveBeenCalledWith(
      '[daily-report] pending approvals count failed: Command failed: sqlite3: database is locked\n',
    );
    expect(vi.mocked(execFileSync).mock.calls[0]?.[2]).toMatchObject({ timeout: 15_000 });
  });

  it('logs a thrown non-Error value', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw 'boom';
    });
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(countPendingApprovals('/db')).toBeNull();
    expect(write).toHaveBeenCalledWith('[daily-report] pending approvals count failed: boom\n');
  });

  it.each(['abc', '-1', '1\n2', '3 rows'])('rejects non-count output %j', (output) => {
    vi.mocked(execFileSync).mockReturnValue(output);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(countPendingApprovals('/db')).toBeNull();
  });

  it('logs and returns null when sqlite3 prints something that is not a count', () => {
    vi.mocked(execFileSync).mockReturnValue('');
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(countPendingApprovals('/db')).toBeNull();
    expect(String(write.mock.calls[0]?.[0])).toContain('unexpected sqlite3 output');
    write.mockRestore();
    vi.mocked(execFileSync).mockReset();
  });
});

describe('buildPendingApprovalsSection', () => {
  const env = { BASE_URL: 'https://example.com' };

  it('shows the count and an admin link when laws are pending', () => {
    const section = buildPendingApprovalsSection(3, env);
    expect(section.title).toBe('PENDING APPROVALS');
    expect(section.items).toEqual([
      { label: 'Awaiting Approval', value: '3', tone: 'warning' },
      {
        label: 'Review Queue',
        value: `https://example.com${ADMIN_UI_PATH}`,
        href: `https://example.com${ADMIN_UI_PATH}`,
      },
    ]);
  });

  it('says nothing is pending and omits the link when the count is zero', () => {
    const section = buildPendingApprovalsSection(0, env);
    expect(section.items).toEqual([
      { label: 'Awaiting Approval', value: '0 (nothing to review)', tone: 'success' },
    ]);
    expect(JSON.stringify(section)).not.toContain(ADMIN_UI_PATH);
  });

  it('flags an unavailable count without a link', () => {
    const section = buildPendingApprovalsSection(null, env);
    expect(section.items).toEqual([
      { label: 'Awaiting Approval', value: 'Count unavailable - see the daily-report log', tone: 'warning' },
    ]);
  });
});

describe('daily report pending approvals', () => {
  function liveReport(sqliteResult: string | Error, baseUrl = 'https://example.com', withDb = true) {
    const repoRoot = scratchDir('daily-report-pending-');
    mkdirSync(path.join(repoRoot, 'backend'));
    if (withDb) {
      writeFileSync(path.join(repoRoot, 'backend/murphys.db'), '');
    }
    vi.mocked(execFileSync).mockImplementation((command, args) => {
      if (command === 'sqlite3' && String(args?.[1]).includes("status='in_review'")) {
        if (sqliteResult instanceof Error) {
          throw sqliteResult;
        }
        return sqliteResult;
      }
      return '';
    });
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.stubEnv('BASE_URL', baseUrl);
    const report = collectDailyReport({ repoRoot, now: new Date(Date.UTC(2026, 1, 4)) });
    const logged = write.mock.calls.map(([chunk]) => String(chunk));
    return { report, logged };
  }

  it('includes the count and a working admin link in text and HTML when non-zero', () => {
    const { report } = liveReport('4');
    const url = `https://example.com${ADMIN_UI_PATH}`;
    const text = renderPlainTextReport(report);
    expect(text).toContain(url);
    expect(text).toContain('PENDING APPROVALS');
    expect(text).toMatch(/Awaiting Approval\W+4\b/);
    expect(renderHtmlReport(report)).toContain(`<a href="${url}"`);
  });

  it('escapes the admin link in HTML', () => {
    const { report } = liveReport('2', 'https://example.com/a&b');
    const html = renderHtmlReport(report);
    expect(html).toContain('href="https://example.com/a&amp;b/admin"');
  });

  it('flags the count as unavailable and logs when the database file is missing', () => {
    const { report, logged } = liveReport('5', 'https://example.com', false);
    const pending = report.sections.find((entry) => entry.title === 'PENDING APPROVALS');
    expect(pending?.items[0]?.value).toContain('Count unavailable');
    expect(logged.some((line) => line.includes('database not found'))).toBe(true);
  });

  it('reports zero without a link', () => {
    const { report } = liveReport('0');
    const text = renderPlainTextReport(report);
    expect(text).toContain('PENDING APPROVALS');
    expect(text).not.toContain(ADMIN_UI_PATH);
  });

  it('still produces the report and logs when the count fails', () => {
    const { report, logged } = liveReport(new Error('no such table: laws'));
    expect(renderPlainTextReport(report)).toContain('Count unavailable');
    expect(report.sections.some((entry) => entry.title === 'WEBSITE ACTIVITY')).toBe(true);
    expect(logged).toContain('[daily-report] pending approvals count failed: no such table: laws\n');
  });
});

describe('loadConfigFromEnvFiles', () => {
  function repoWith(files: Record<string, string>) {
    const repoRoot = scratchDir('daily-report-env-');
    mkdirSync(path.join(repoRoot, 'backend'));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(repoRoot, name), content);
    }
    return repoRoot;
  }

  it('reads BASE_URL, ALERT_EMAIL and EMAIL_TO from the root .env', () => {
    const env: NodeJS.ProcessEnv = {};
    loadConfigFromEnvFiles(
      repoWith({ '.env': 'BASE_URL=https://root.example.com\nALERT_EMAIL=alerts@example.com\nEMAIL_TO=admin@example.com\n' }),
      env,
    );
    expect(env).toEqual({
      BASE_URL: 'https://root.example.com',
      ALERT_EMAIL: 'alerts@example.com',
      EMAIL_TO: 'admin@example.com',
    });
  });

  it('falls back to backend/.env and lets the root file win, key by key', () => {
    const env: NodeJS.ProcessEnv = {};
    loadConfigFromEnvFiles(
      repoWith({ '.env': 'OTHER=1\n', 'backend/.env': 'BASE_URL=https://backend.example.com\nEMAIL_TO=admin@example.com\n' }),
      env,
    );
    expect(env).toEqual({ BASE_URL: 'https://backend.example.com', EMAIL_TO: 'admin@example.com' });

    const both: NodeJS.ProcessEnv = {};
    loadConfigFromEnvFiles(
      repoWith({
        '.env': 'BASE_URL=https://root.example.com\n',
        'backend/.env': 'BASE_URL=https://backend.example.com\nEMAIL_TO=admin@example.com\n',
      }),
      both,
    );
    expect(both).toEqual({ BASE_URL: 'https://root.example.com', EMAIL_TO: 'admin@example.com' });
  });

  it('skips a blank value in the first file and uses the next one', () => {
    const env: NodeJS.ProcessEnv = {};
    loadConfigFromEnvFiles(repoWith({ '.env': 'EMAIL_TO=\n', 'backend/.env': 'EMAIL_TO=admin@example.com\n' }), env);
    expect(env.EMAIL_TO).toBe('admin@example.com');
  });

  it('does not override a non-blank existing value or touch other variables', () => {
    const env: NodeJS.ProcessEnv = { BASE_URL: 'https://already.example.com' };
    loadConfigFromEnvFiles(repoWith({ '.env': 'BASE_URL=https://root.example.com\nOTHER=x\nEMAIL_TO=admin@example.com\n' }), env);
    expect(env).toEqual({ BASE_URL: 'https://already.example.com', EMAIL_TO: 'admin@example.com' });
  });

  it('replaces a blank existing value', () => {
    const env: NodeJS.ProcessEnv = { EMAIL_TO: '  ' };
    loadConfigFromEnvFiles(repoWith({ '.env': 'EMAIL_TO=admin@example.com\n' }), env);
    expect(env.EMAIL_TO).toBe('admin@example.com');
  });

  it('leaves env untouched when files are missing or hold none of the settings', () => {
    const env: NodeJS.ProcessEnv = {};
    loadConfigFromEnvFiles(repoWith({ '.env': 'OTHER=1\n' }), env);
    expect(env).toEqual({});
    loadConfigFromEnvFiles(scratchDir('daily-report-empty-'), env);
    expect(env).toEqual({});
  });

  it('defaults to process.env', () => {
    vi.stubEnv('BASE_URL', '');
    loadConfigFromEnvFiles(repoWith({ '.env': 'BASE_URL=https://proc.example.com\n' }));
    expect(process.env.BASE_URL).toBe('https://proc.example.com');
  });
});

describe('reportRecipient', () => {
  it('sends the live report to ALERT_EMAIL, then EMAIL_TO', () => {
    expect(reportRecipient({ ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' }, false)).toBe('alerts@example.com');
    expect(reportRecipient({ EMAIL_TO: 'admin@example.com' }, false)).toBe('admin@example.com');
  });

  it('has no built-in address: a live report with nothing configured has no recipient', () => {
    expect(reportRecipient({}, false)).toBeNull();
    expect(reportRecipient({ ALERT_EMAIL: ' ', EMAIL_TO: '' }, false)).toBeNull();
  });

  it('sends a --test-email report only to DAILY_REPORT_TEST_RECIPIENT, never to the alert address', () => {
    const env = { DAILY_REPORT_TEST_RECIPIENT: ' tester@example.com ', ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' };
    expect(reportRecipient(env, true)).toBe('tester@example.com');
    expect(reportRecipient({ ALERT_EMAIL: 'alerts@example.com' }, true)).toBeNull();
    expect(reportRecipient({ DAILY_REPORT_TEST_RECIPIENT: '' }, true)).toBeNull();
  });
});

describe('runCli', () => {
  function fakeSendmail(exitCode = 0) {
    const dir = scratchDir('daily-report-sendmail-');
    const log = path.join(dir, 'sendmail.log');
    const script = path.join(dir, 'sendmail');
    writeFileSync(script, `#!/bin/bash\n{ echo "ARGS: $*"; cat; } > "$SENDMAIL_LOG"\necho "sendmail said no" >&2\nexit ${exitCode}\n`);
    chmodSync(script, 0o755);
    return { script, log, read: () => { try { return readFileSync(log, 'utf8'); } catch { return ''; } } };
  }

  it('fails before collecting anything when a live report has no recipient', () => {
    const sendmail = fakeSendmail();
    expect(() => runCli([], { env: { SENDMAIL_LOG: sendmail.log }, sendmailPath: sendmail.script })).toThrow(
      'No alert recipient. Set ALERT_EMAIL or EMAIL_TO',
    );
    expect(execFileSync).not.toHaveBeenCalled();
    expect(sendmail.read()).toBe('');
  });

  it('needs DAILY_REPORT_TEST_RECIPIENT for --test-email, even when an alert address is set', () => {
    const sendmail = fakeSendmail();
    const env = { ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com', SENDMAIL_LOG: sendmail.log };
    expect(() => runCli(['--test-email'], { env, sendmailPath: sendmail.script })).toThrow(
      'DAILY_REPORT_TEST_RECIPIENT must be set for --test-email',
    );
    expect(execFileSync).not.toHaveBeenCalled();
    expect(sendmail.read()).toBe('');
  });

  it('sends a --test-email report only to the test recipient', () => {
    const sendmail = fakeSendmail();
    runCli(['--test-email'], {
      env: {
        DAILY_REPORT_TEST_RECIPIENT: 'tester@example.com',
        ALERT_EMAIL: 'alerts@example.com',
        EMAIL_TO: 'admin@example.com',
        SENDMAIL_LOG: sendmail.log,
      },
      sendmailPath: sendmail.script,
    });
    const sent = sendmail.read();
    expect(sent).toContain('ARGS: -t tester@example.com');
    expect(sent).toContain('To: tester@example.com');
    expect(sent).not.toContain('alerts@example.com');
    expect(sent).not.toContain('admin@example.com');
  });

  it('raises the error text sendmail gives when it fails', () => {
    const sendmail = fakeSendmail(75);
    expect(() =>
      runCli(['--test-email'], {
        env: { DAILY_REPORT_TEST_RECIPIENT: 'tester@example.com', SENDMAIL_LOG: sendmail.log },
        sendmailPath: sendmail.script,
      }),
    ).toThrow('sendmail said no');
  });

  it('says why sendmail could not be started at all, instead of "exited with code unknown"', () => {
    const missing = path.join(scratchDir('daily-report-sendmail-'), 'no-such-sendmail');
    expect(() =>
      runCli(['--test-email'], {
        env: { DAILY_REPORT_TEST_RECIPIENT: 'tester@example.com' },
        sendmailPath: missing,
      }),
    ).toThrow(/Could not run .*no-such-sendmail: .*\(PATH: /);
  });
});

describe('off-site backup status in the report', () => {
  const ok = 'ok (encrypted, off:bucket, retention 30 days)';
  const log = [
    '[2026-10-31 04:00:09] Backup complete. Total: 41 files, Size: 120M',
    '[2026-10-31 04:00:10] Off-site copy: not configured (local integrity only)',
    '[2026-11-01 04:00:09] Backup complete. Total: 42 files, Size: 121M',
    `[2026-11-01 04:00:14] Off-site copy: ${ok}`,
  ].join('\n');
  const now = new Date('2026-11-01T10:00:00Z');

  it('takes the text and time stamp of the last Off-site copy line', () => {
    expect(parseOffsiteBackupStatus(log)).toEqual({ status: ok, loggedAt: '2026-11-01 04:00:14', interrupted: false });
  });

  it('keeps a line that has no time stamp, and returns null when the log has no Off-site copy line', () => {
    expect(parseOffsiteBackupStatus('Off-site copy: ok\n')).toEqual({ status: 'ok', loggedAt: null, interrupted: false });
    expect(parseOffsiteBackupStatus('[2026-11-01 04:00:09] Backup complete.\n')).toBeNull();
  });

  const logFile = (text: string) => {
    const file = path.join(scratchDir('offsite-report-'), 'backup.log');
    writeFileSync(file, text);
    return file;
  };

  it('shows a recent successful copy without a warning', () => {
    expect(offsiteBackupItem(logFile(log), now)).toEqual({
      label: 'Off-site copy',
      value: `${ok} (logged 2026-11-01 04:00:14 UTC)`,
    });
  });

  it('warns when the last run was not configured', () => {
    const item = offsiteBackupItem(logFile('[2026-11-01 04:00:10] Off-site copy: not configured (local integrity only)\n'), now);
    expect(item).toMatchObject({ tone: 'warning', value: expect.stringContaining('not configured') });
  });

  it('warns when the last run failed, so a failure is not hidden behind an older ok line', () => {
    const failed = `${log}\n[2026-11-02 04:00:20] ERROR: Off-site copy: FAILED (upload of murphys_db_x.db failed)\n`;
    const item = offsiteBackupItem(logFile(failed), new Date('2026-11-02T10:00:00Z'));
    expect(item.tone).toBe('warning');
    expect(item.value).toContain('FAILED (upload of murphys_db_x.db failed)');
  });

  it('warns when the last result is older than 30 hours, so one missed daily run shows at the next report', () => {
    expect(offsiteBackupItem(logFile(log), new Date('2026-11-02T05:00:00Z')).tone).toBeUndefined();
    const item = offsiteBackupItem(logFile(log), new Date('2026-11-02T11:00:00Z'));
    expect(item.tone).toBe('warning');
    expect(item.value).toContain('no newer result for over 30 hours');
  });

  it('warns on the first run that dies before the off-site step, even though yesterday is under 30 hours old', () => {
    const died = `${log}\n[2026-11-02 04:00:01] Starting backup...\n[2026-11-02 04:00:02] ERROR: SQLite backup failed for x\n`;
    const item = offsiteBackupItem(logFile(died), new Date('2026-11-02T05:00:00Z'));
    expect(item.tone).toBe('warning');
    expect(item.value).toContain('did not reach the off-site step');
    expect(item.value).toContain(ok);
  });

  it('does not warn when the off-site result follows the latest start', () => {
    const complete = `${log}\n[2026-11-02 04:00:01] Starting backup...\n[2026-11-02 04:00:20] Off-site copy: ${ok}\n`;
    expect(offsiteBackupItem(logFile(complete), new Date('2026-11-02T05:00:00Z')).tone).toBeUndefined();
  });

  it('does not treat a line without a time stamp as stale', () => {
    expect(offsiteBackupItem(logFile('Off-site copy: ok\n'), now)).toEqual({ label: 'Off-site copy', value: 'ok' });
  });

  it('reads only the end of a large log', () => {
    const filler = '[2026-01-01 04:00:00] Backup complete.\n'.repeat(20000);
    expect(offsiteBackupItem(logFile(`[2025-12-31 04:00:00] Off-site copy: ok\n${filler}${log}\n`), now).value).toContain('logged 2026-11-01');
  });

  it('warns when the log has no result, and when it cannot be read', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(offsiteBackupItem(logFile('nothing here\n'), now)).toMatchObject({ tone: 'warning', value: 'no result in the backup log' });
    expect(offsiteBackupItem('/nonexistent/backup.log', now)).toMatchObject({ tone: 'warning', value: 'no result in the backup log' });
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('off-site backup status failed'));
  });
});
