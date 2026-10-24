import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { collectDailyReport, logCollectorError, parsePm2Jlist } from '../../scripts/render-daily-report.ts';

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
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const repoRoot = mkdtempSync(path.join(tmpdir(), 'daily-report-'));
    // Sunday the 1st exercises the weekly and monthly collectors too.
    collectDailyReport({ repoRoot, now: new Date(Date.UTC(2026, 1, 1)) });
    const logged = write.mock.calls.map(([chunk]) => String(chunk));
    write.mockRestore();
    for (const collector of ['log analysis', 'vulnerability scan', 'cost optimization report']) {
      expect(logged.some((line) => line.startsWith(`[daily-report] ${collector} failed: `))).toBe(true);
    }
  });
});
