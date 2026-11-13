import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LawService } from '../../src/services/laws.service.ts';

// The daily cron script and the API both call selectLawOfTheDay, in two processes, so these tests use real
// SQLite files with two connections as well as an in-memory database.

type Db = InstanceType<typeof Database>;

const SCHEMA = `
  CREATE TABLE laws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'published'
  );
  CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    law_id INTEGER,
    vote_type TEXT,
    voter_identifier TEXT
  );
  CREATE TABLE law_of_the_day_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    law_id INTEGER NOT NULL,
    featured_date TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
    UNIQUE(law_id, featured_date)
  );
`;

const DAY = '2026-11-13';

const addLaw = (db: Db, text: string, status = 'published'): number =>
  Number(db.prepare('INSERT INTO laws (text, status) VALUES (?, ?)').run(text, status).lastInsertRowid);

const picksFor = (db: Db, date: string): number[] =>
  (db.prepare('SELECT law_id FROM law_of_the_day_history WHERE featured_date = ? ORDER BY id').all(date) as { law_id: number }[])
    .map((row) => row.law_id);

describe('LawService.selectLawOfTheDay', () => {
  let db: Db;
  let service: LawService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    service = new LawService(db);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    db.close();
  });

  it('picks the most upvoted law that has not been featured in a year, and records it', () => {
    addLaw(db, 'Quiet law');
    const popular = addLaw(db, 'Popular law');
    db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'a')").run(popular);

    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: popular, featuredDate: DAY, created: true });
    expect(picksFor(db, DAY)).toEqual([popular]);
  });

  it('breaks a tie in votes alphabetically by the text of the law', () => {
    addLaw(db, 'Zebra law');
    const apple = addLaw(db, 'Apple law');
    addLaw(db, 'Mango law');

    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: apple, featuredDate: DAY, created: true });
  });

  it('picks for today (UTC) when no day is given', () => {
    const law = addLaw(db, 'Only law');
    // 23:59 UTC on Nov 12 is already Nov 13 in a zone east of UTC: the day must still be the UTC one
    vi.useFakeTimers({ now: new Date('2026-11-12T23:59:59.000Z'), toFake: ['Date'] });

    expect(service.selectLawOfTheDay()).toEqual({ lawId: law, featuredDate: '2026-11-12', created: true });
    vi.useRealTimers();
  });

  it('picks once per day: a second call, from the API or the script, finds the pick', () => {
    addLaw(db, 'Law A');
    addLaw(db, 'Law B');

    const first = service.selectLawOfTheDay(DAY);
    const second = new LawService(db).selectLawOfTheDay(DAY);

    expect(first?.created).toBe(true);
    expect(second).toEqual({ lawId: first?.lawId, featuredDate: DAY, created: false });
    expect(picksFor(db, DAY)).toHaveLength(1);
  });

  it('leaves a day that is already picked untouched', () => {
    addLaw(db, 'Law A');
    const featured = addLaw(db, 'Law B');
    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(featured, DAY);

    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: featured, featuredDate: DAY, created: false });
    expect(picksFor(db, DAY)).toEqual([featured]);
  });

  it('picks a new law when the one featured for the day was unpublished, and keeps the newest pick', () => {
    const rejected = addLaw(db, 'Rejected later');
    const other = addLaw(db, 'Other law');
    db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(rejected, DAY);
    db.prepare("UPDATE laws SET status = 'rejected' WHERE id = ?").run(rejected);

    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: other, featuredDate: DAY, created: true });
    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: other, featuredDate: DAY, created: false });
    expect(picksFor(db, DAY)).toEqual([rejected, other]);
  });

  describe('the one-year rule', () => {
    const daysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
    const feature = (lawId: number, date: string): void => {
      db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(lawId, date);
    };
    const upvote = (lawId: number): void => {
      db.prepare("INSERT INTO votes (law_id, vote_type, voter_identifier) VALUES (?, 'up', 'a')").run(lawId);
    };

    it('skips a law featured in the last year, even a more upvoted one', () => {
      const popular = addLaw(db, 'Popular law');
      const other = addLaw(db, 'Other law');
      upvote(popular);
      feature(popular, daysAgo(1));

      expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: other, featuredDate: DAY, created: true });
    });

    it('features a law again once its last turn is more than a year old', () => {
      const popular = addLaw(db, 'Popular law');
      addLaw(db, 'Other law');
      upvote(popular);
      feature(popular, daysAgo(366));

      expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: popular, featuredDate: DAY, created: true });
    });

    it('counts the year the way SQLite does: 365 days ago is over, the day after still counts', () => {
      const sqliteDay = (offset: string): string => (db.prepare("SELECT date('now', ?) AS day").get(offset) as { day: string }).day;
      const popular = addLaw(db, 'Popular law');
      const other = addLaw(db, 'Other law');
      upvote(popular);

      feature(popular, sqliteDay('-364 days'));
      expect(service.selectLawOfTheDay('2026-01-01')).toEqual({ lawId: other, featuredDate: '2026-01-01', created: true });

      db.prepare('DELETE FROM law_of_the_day_history').run();
      feature(popular, sqliteDay('-365 days'));
      expect(service.selectLawOfTheDay('2026-01-02')).toEqual({ lawId: popular, featuredDate: '2026-01-02', created: true });
    });

    it('falls back to any published law when every one was featured in the last year', () => {
      const law = addLaw(db, 'Only law');
      feature(law, daysAgo(1));

      expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: law, featuredDate: DAY, created: true });
    });
  });

  it('returns null and records nothing when no law is published', () => {
    addLaw(db, 'Waiting for review', 'in_review');

    expect(service.selectLawOfTheDay(DAY)).toBeNull();
    expect(picksFor(db, DAY)).toEqual([]);
  });

  // The stand-in below offers only `immediate`, so this test also fails if the pick ever runs as a deferred
  // transaction, which would look at the table before it holds the write lock
  it('uses the pick another process makes between its first check and the lock', () => {
    addLaw(db, 'Law A');
    const theirs = addLaw(db, 'Law B');
    const realTransaction = db.transaction.bind(db) as (fn: () => unknown) => { immediate: () => unknown };
    // The other process commits its pick just before this one gets the write lock
    vi.spyOn(db, 'transaction').mockImplementation(((fn: () => unknown) => {
      const run = realTransaction(fn);
      return {
        immediate: () => {
          db.prepare('INSERT INTO law_of_the_day_history (law_id, featured_date) VALUES (?, ?)').run(theirs, DAY);
          return run.immediate();
        },
      };
    }) as never);

    expect(service.selectLawOfTheDay(DAY)).toEqual({ lawId: theirs, featuredDate: DAY, created: false });
    expect(picksFor(db, DAY)).toEqual([theirs]);
  });

  describe('with two connections to one database file', () => {
    let directory: string;
    let file: string;
    let first: Db;
    let second: Db;

    beforeEach(() => {
      directory = mkdtempSync(path.join(tmpdir(), 'law-of-the-day-'));
      file = path.join(directory, 'murphys.db');
      first = new Database(file);
      first.pragma('journal_mode = WAL');
      first.exec(SCHEMA);
      addLaw(first, 'Law A');
      addLaw(first, 'Law B');
      // No wait for a lock, so a pick that does not hold the write lock first is visible as an error
      second = new Database(file, { timeout: 0 });
    });

    afterEach(() => {
      first.close();
      second.close();
      rmSync(directory, { recursive: true, force: true });
    });

    it('does not pick while another connection holds the write lock', () => {
      first.exec('BEGIN IMMEDIATE');

      expect(() => new LawService(second).selectLawOfTheDay(DAY)).toThrow(/database is locked/);

      first.exec('ROLLBACK');
      expect(picksFor(first, DAY)).toEqual([]);
    });

    it('lets the second process find the pick the first one committed', () => {
      const pick = new LawService(first).selectLawOfTheDay(DAY);

      expect(new LawService(second).selectLawOfTheDay(DAY)).toEqual({ lawId: pick?.lawId, featuredDate: DAY, created: false });
      expect(picksFor(first, DAY)).toHaveLength(1);
    });
  });
});
