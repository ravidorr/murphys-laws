import { describe, expect, it } from 'vitest';
import { parsePm2Jlist } from '../../scripts/render-daily-report.ts';

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
