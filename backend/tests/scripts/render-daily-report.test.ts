import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  ADMIN_UI_PATH,
  buildAdminUrl,
  buildPendingApprovalsSection,
  collectDailyReport,
  countPendingApprovals,
  loadBaseUrlFromEnvFiles,
  logCollectorError,
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
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'daily-report-'));
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
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'daily-report-pending-'));
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
    expect(html).toContain('href="https://example.com/a&amp;b/api/v1/admin/ui"');
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

describe('loadBaseUrlFromEnvFiles', () => {
  function repoWith(files: Record<string, string>) {
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'daily-report-env-'));
    mkdirSync(path.join(repoRoot, 'backend'));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(repoRoot, name), content);
    }
    return repoRoot;
  }

  it('reads BASE_URL from the root .env', () => {
    const env: NodeJS.ProcessEnv = {};
    loadBaseUrlFromEnvFiles(repoWith({ '.env': 'BASE_URL=https://root.example.com\n' }), env);
    expect(env.BASE_URL).toBe('https://root.example.com');
  });

  it('falls back to backend/.env and lets the root file win', () => {
    const env: NodeJS.ProcessEnv = {};
    loadBaseUrlFromEnvFiles(
      repoWith({ '.env': 'OTHER=1\n', 'backend/.env': 'BASE_URL=https://backend.example.com\n' }),
      env,
    );
    expect(env.BASE_URL).toBe('https://backend.example.com');
    const both: NodeJS.ProcessEnv = {};
    loadBaseUrlFromEnvFiles(
      repoWith({ '.env': 'BASE_URL=https://root.example.com\n', 'backend/.env': 'BASE_URL=https://backend.example.com\n' }),
      both,
    );
    expect(both.BASE_URL).toBe('https://root.example.com');
  });

  it('does not override an existing value or touch other variables', () => {
    const env: NodeJS.ProcessEnv = { BASE_URL: 'https://already.example.com' };
    loadBaseUrlFromEnvFiles(repoWith({ '.env': 'BASE_URL=https://root.example.com\nALERT_EMAIL=x@y.z\n' }), env);
    expect(env).toEqual({ BASE_URL: 'https://already.example.com' });
  });

  it('leaves env untouched when files are missing or have no BASE_URL', () => {
    const env: NodeJS.ProcessEnv = {};
    loadBaseUrlFromEnvFiles(repoWith({ '.env': 'OTHER=1\n' }), env);
    expect(env).toEqual({});
  });

  it('defaults to process.env', () => {
    vi.stubEnv('BASE_URL', '');
    loadBaseUrlFromEnvFiles(repoWith({ '.env': 'BASE_URL=https://proc.example.com\n' }));
    expect(process.env.BASE_URL).toBe('https://proc.example.com');
  });
});
