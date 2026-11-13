import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { runSelectLawOfDay } from '../../scripts/select-law-of-day.ts';
import type { LawService } from '../../src/services/laws.service.ts';
import { scratchDir } from '../helpers/shell-sandbox.ts';

const backendDir = path.resolve(__dirname, '../..');
const cronFile = path.join(backendDir, 'config/cron.d/murphys-laws-law-of-day');

const NOW = new Date('2026-11-13T00:00:02.345Z');
const STAMP = '[2026-11-13T00:00:02.345Z] [Law of the Day]';

describe('runSelectLawOfDay', () => {
  const run = (selectLawOfTheDay: Mock<LawService['selectLawOfTheDay']>) => {
    const log = vi.fn();
    const logError = vi.fn();
    const code = runSelectLawOfDay({ selectLawOfTheDay }, { now: () => NOW, log, logError });
    return { code, log, logError };
  };

  it('picks the law of the current UTC day and logs it with a timestamp', () => {
    const select = vi.fn<LawService['selectLawOfTheDay']>().mockReturnValue({ lawId: 42, featuredDate: '2026-11-13', created: true });

    const { code, log, logError } = run(select);

    expect(select).toHaveBeenCalledWith('2026-11-13');
    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(`${STAMP} Picked law 42 for 2026-11-13`);
    expect(logError).not.toHaveBeenCalled();
  });

  it('says so, and succeeds, when the day was already picked (by the API or an earlier run)', () => {
    const select = vi.fn<LawService['selectLawOfTheDay']>().mockReturnValue({ lawId: 42, featuredDate: '2026-11-13', created: false });

    const { code, log } = run(select);

    expect(code).toBe(0);
    expect(log).toHaveBeenCalledWith(`${STAMP} Already picked for 2026-11-13: law 42`);
  });

  it('fails, visibly, when there is no published law', () => {
    const { code, log, logError } = run(vi.fn<LawService['selectLawOfTheDay']>().mockReturnValue(null));

    expect(code).toBe(1);
    expect(logError).toHaveBeenCalledWith(`${STAMP} ERROR: no published law to pick from`);
    expect(log).not.toHaveBeenCalled();
  });

  it('uses the UTC date even just before midnight UTC', () => {
    const select = vi.fn<LawService['selectLawOfTheDay']>().mockReturnValue({ lawId: 1, featuredDate: '2026-11-12', created: true });

    runSelectLawOfDay({ selectLawOfTheDay: select }, { now: () => new Date('2026-11-12T23:59:59.999Z'), log: vi.fn() });

    expect(select).toHaveBeenCalledWith('2026-11-12');
  });
});

describe('the cron entry', () => {
  const lines = readFileSync(cronFile, 'utf8').split('\n');
  const entries = lines.filter((line) => line.trim() !== '' && !line.startsWith('#') && !/^[A-Z_]+=/.test(line));
  const [entry] = entries;
  const match = /^(\S+ \S+ \S+ \S+ \S+) (\S+) (.+)$/.exec(entry ?? '');
  const command = match?.[3] ?? '';

  it('is a single job that runs as root at 00:00 UTC', () => {
    expect(entries).toHaveLength(1);
    expect(match?.[1]).toBe('0 0 * * *');
    expect(match?.[2]).toBe('root');
    expect(lines).toContain('CRON_TZ=UTC');
    expect(readFileSync(cronFile, 'utf8').endsWith('\n')).toBe(true);
  });

  it('uses absolute paths, no % (cron turns it into a newline) and a log directory the deploy creates', () => {
    expect(command).not.toContain('%');
    expect(command).toMatch(/^\{ cd \/root\/murphys-laws\/backend && \/usr\/bin\/node [^;]*; \} >> /);
    expect(command).toMatch(/; \} >> \/root\/murphys-laws\/backend\/logs\/law-of-day\.log 2>&1$/);
  });

  it('runs a script the repository ships, with a tsx that is a production dependency', () => {
    const packageJson = JSON.parse(readFileSync(path.join(backendDir, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

    expect(command).toContain('node_modules/tsx/dist/cli.mjs scripts/select-law-of-day.ts');
    expect(existsSync(path.join(backendDir, 'scripts/select-law-of-day.ts'))).toBe(true);
    expect(existsSync(path.join(backendDir, 'scripts/select-law-of-day.mjs'))).toBe(false);
    expect(packageJson.dependencies).toHaveProperty('tsx');
  });

  // The command from the cron file, run the way cron runs it (sh -c), with /root/murphys-laws moved to a
  // scratch copy of the layout and /usr/bin/node replaced by the node running this test
  const cronJob = (laws: string) => {
    const app = scratchDir('law-of-day-cron-');
    const backend = path.join(app, 'backend');
    mkdirSync(path.join(backend, 'scripts'), { recursive: true });
    mkdirSync(path.join(backend, 'logs'));
    copyFileSync(path.join(backendDir, 'scripts/select-law-of-day.ts'), path.join(backend, 'scripts/select-law-of-day.ts'));
    symlinkSync(path.join(backendDir, 'src'), path.join(backend, 'src'));
    // The node_modules that holds tsx: backend/node_modules on the server, the hoisted root one in a workspace checkout
    const nodeModules = path.dirname(path.dirname(createRequire(import.meta.url).resolve('tsx/package.json')));
    symlinkSync(nodeModules, path.join(backend, 'node_modules'));

    const dbFile = path.join(backend, 'murphys.db');
    const db = new Database(dbFile);
    db.exec(`
      CREATE TABLE laws (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, text TEXT NOT NULL, status TEXT DEFAULT 'published');
      CREATE TABLE votes (id INTEGER PRIMARY KEY AUTOINCREMENT, law_id INTEGER, vote_type TEXT, voter_identifier TEXT);
      CREATE TABLE law_of_the_day_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        law_id INTEGER NOT NULL,
        featured_date TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(law_id, featured_date)
      );
      ${laws}
    `);
    db.close();

    const scratchCommand = command
      .replaceAll('/root/murphys-laws', app)
      .replace('/usr/bin/node', `'${process.execPath}'`);
    const run = (env: Record<string, string> = {}) => spawnSync('sh', ['-c', scratchCommand], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', ...env }, timeout: 60_000 });
    // cron's own redirect sends everything the job prints to the log, so that is where a failure shows
    const logFile = path.join(backend, 'logs/law-of-day.log');
    const readLog = () => (existsSync(logFile) ? readFileSync(logFile, 'utf8') : '');
    // The same command started n times at once, as two crons at 00:00 would (or the cron and a stale second entry)
    const runTogether = (n: number) => Promise.all(Array.from({ length: n }, () => new Promise<number | null>((resolve) => {
      const child = spawn('sh', ['-c', scratchCommand], { env: { PATH: '/usr/bin:/bin' }, stdio: 'ignore' });
      child.on('close', resolve);
    })));
    return { run, runTogether, readLog, dbFile };
  };

  it('picks the law once when cron runs the command, again and again, against a real database', () => {
    const { run, readLog, dbFile } = cronJob("INSERT INTO laws (text) VALUES ('Law A'), ('Law B');");

    const first = run();
    const second = run();

    const log = readLog();
    expect([first.status, second.status], `${first.stderr}${second.stderr}${log}`).toEqual([0, 0]);
    expect(log).toMatch(/\[Law of the Day\] Picked law \d+ for \d{4}-\d{2}-\d{2}\n/);
    expect(log).toMatch(/\[Law of the Day\] Already picked for \d{4}-\d{2}-\d{2}: law \d+\n/);
    const check = new Database(dbFile, { readonly: true });
    expect(check.prepare('SELECT COUNT(*) AS picks FROM law_of_the_day_history').get()).toEqual({ picks: 1 });
    check.close();
  }, 90_000);

  it('picks once when the job runs three times at the same moment, and every run succeeds', async () => {
    const { runTogether, readLog, dbFile } = cronJob("INSERT INTO laws (text) VALUES ('Law A'), ('Law B'), ('Law C');");

    const codes = await runTogether(3);

    const log = readLog();
    expect(codes, log).toEqual([0, 0, 0]);
    expect(log.match(/\] Picked law /g)).toHaveLength(1);
    expect(log.match(/\] Already picked for /g)).toHaveLength(2);
    const check = new Database(dbFile, { readonly: true });
    expect(check.prepare('SELECT COUNT(*) AS picks FROM law_of_the_day_history').get()).toEqual({ picks: 1 });
    check.close();
  }, 90_000);

  it('waits for a pick that another connection has not committed yet and then uses it, instead of picking too', async () => {
    const { runTogether, readLog, dbFile } = cronJob("INSERT INTO laws (text) VALUES ('Law A'), ('Law B');");
    const day = new Date().toISOString().split('T')[0];
    // The production database is in WAL mode, which the job's connection switches on when it opens it
    const prepare = new Database(dbFile);
    prepare.pragma('journal_mode = WAL');
    prepare.close();
    // The request that wins the race: it holds SQLite's write lock with its pick of law B (the job's own query would choose A)
    const holder = new Database(dbFile);
    holder.exec('BEGIN IMMEDIATE');
    holder.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (2, ?)').run(day);

    const job = runTogether(1);
    // Wait for the job itself, not for a fixed time: its database service prints this line when it has opened the
    // file, and the only things left before it blocks on the write lock are two statements
    const startedAt = Date.now();
    while (!readLog().includes('Database connected') && Date.now() - startedAt < 60_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(readLog(), 'the job opened the database while the lock was held').toContain('Database connected');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const committedAt = Date.now();
    holder.exec('COMMIT');
    holder.close();
    const codes = await job;

    const log = readLog();
    expect(codes, log).toEqual([0]);
    expect(log).toMatch(/\] Already picked for \d{4}-\d{2}-\d{2}: law 2\n/);
    // It started before the commit and could only answer after it: it waited for the lock, and did not pick for itself
    const answeredAt = Date.parse(/\[([^\]]+)\] \[Law of the Day\] Already picked/.exec(log)?.[1] ?? '');
    expect(answeredAt).toBeGreaterThanOrEqual(committedAt);
    const check = new Database(dbFile, { readonly: true });
    expect(check.prepare('SELECT law_id FROM law_of_the_day_history').all()).toEqual([{ law_id: 2 }]);
    check.close();
  }, 90_000);

  it('fails visibly in the log, with a non-zero exit, when no law is published', () => {
    const { run, readLog } = cronJob("INSERT INTO laws (text, status) VALUES ('Waiting', 'in_review');");

    const result = run();

    expect(result.status).toBe(1);
    expect(readLog()).toMatch(/\[Law of the Day\] ERROR: no published law to pick from\n/);
  }, 90_000);

  it('fails visibly, and does not create an empty database, when the database file is missing', () => {
    const { run, readLog, dbFile } = cronJob('');
    rmSync(dbFile);

    const result = run();

    expect(result.status).toBe(1);
    expect(readLog()).toMatch(/\[Law of the Day\] ERROR:.*murphys\.db does not exist/s);
    expect(existsSync(dbFile)).toBe(false);
  }, 90_000);

  it('opens the database the way the API does: a MURPHYS_DB_PATH that names an empty file is refused, not created over', () => {
    const { run, readLog, dbFile } = cronJob("INSERT INTO laws (text) VALUES ('Law A');");
    const empty = path.join(path.dirname(dbFile), 'empty.db');
    writeFileSync(empty, '');

    const result = run({ MURPHYS_DB_PATH: empty });

    expect(result.status).toBe(1);
    expect(readLog()).toMatch(/\[Law of the Day\] ERROR:.*MURPHYS_DB_PATH must name an existing, non-empty database file/s);
  }, 90_000);

  it('fails visibly in the log, with a non-zero exit, when the database is unusable', () => {
    const { run, readLog, dbFile } = cronJob('');
    const broken = new Database(dbFile);
    broken.exec('DROP TABLE law_of_the_day_history');
    broken.close();

    const result = run();

    expect(result.status).toBe(1);
    expect(readLog()).toMatch(/\[Law of the Day\] ERROR:.*no such table/s);
  }, 90_000);
});
