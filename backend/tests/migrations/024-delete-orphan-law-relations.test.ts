import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../../scripts/migration-runner.ts';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const MIGRATIONS_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), 'db', 'migrations');
const MIGRATION_FILE = '024_delete_orphan_law_relations.sql';
const MIGRATION_SQL = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8');

type Db = ReturnType<typeof createMigratedDb>;

const insertLaw = (db: Db, id: number): void => {
  db.prepare('INSERT INTO laws (id, text, status, first_seen_file_path) VALUES (?, ?, ?, ?)').run(id, `Law ${id} text goes here.`, 'published', `${id}.md`);
};
const insertRelation = (db: Db, from: number, to: number, type = 'COROLLARY_OF'): void => {
  db.prepare('INSERT INTO law_relations (from_law_id, to_law_id, relation_type) VALUES (?, ?, ?)').run(from, to, type);
};
const edges = (db: Db): string[] =>
  (db.prepare('SELECT from_law_id, to_law_id, relation_type FROM law_relations ORDER BY id').all() as Array<{ from_law_id: number; to_law_id: number; relation_type: string }>)
    .map((r) => `${r.from_law_id}>${r.to_law_id}:${r.relation_type}`);

describe('migration 024: delete orphan law_relations', () => {
  let db: Db;

  beforeEach(() => {
    db = createMigratedDb({ before: '024' });
    // Orphans come from deletes made through the sqlite3 CLI, which does not enforce foreign keys; better-sqlite3 enforces
    // them by default, so turn them off to build the same state.
    db.exec('PRAGMA foreign_keys = OFF');
  });
  afterEach(() => { db.close(); });

  it('deletes a relation whose parent law is missing', () => {
    insertLaw(db, 100001);
    insertRelation(db, 100001, 100003);
    db.exec(MIGRATION_SQL);
    expect(edges(db)).toEqual([]);
  });

  it('deletes a relation whose child law is missing', () => {
    insertLaw(db, 100001);
    insertRelation(db, 100004, 100001);
    db.exec(MIGRATION_SQL);
    expect(edges(db)).toEqual([]);
  });

  it('deletes a relation whose two laws are both missing, whatever its type', () => {
    insertRelation(db, 100005, 100006, 'COMMENT_ON');
    insertRelation(db, 100007, 100008, 'COROLLARY_OF');
    db.exec(MIGRATION_SQL);
    expect(edges(db)).toEqual([]);
  });

  it('keeps relations whose two laws exist, whatever their status, and leaves the laws alone', () => {
    insertLaw(db, 100001);
    insertLaw(db, 100002);
    db.prepare("UPDATE laws SET status = 'rejected' WHERE id = 100002").run();
    insertRelation(db, 100002, 100001);
    insertRelation(db, 100001, 100002, 'COMMENT_ON');
    insertRelation(db, 100002, 100009); // an orphan next to the valid rows
    db.exec(MIGRATION_SQL);
    expect(edges(db)).toEqual(['100002>100001:COROLLARY_OF', '100001>100002:COMMENT_ON']);
    expect((db.prepare('SELECT COUNT(*) AS n FROM laws WHERE id IN (100001, 100002)').get() as { n: number }).n).toBe(2);
  });

  it('keeps duplicate edges between existing laws', () => {
    insertLaw(db, 100001);
    insertLaw(db, 100002);
    insertRelation(db, 100002, 100001);
    insertRelation(db, 100002, 100001);
    db.exec(MIGRATION_SQL);
    expect(edges(db)).toHaveLength(2);
  });

  it('applies to an empty table', () => {
    expect(() => db.exec(MIGRATION_SQL)).not.toThrow();
    expect(edges(db)).toEqual([]);
  });

  it('is safe to run twice: the second run changes nothing', () => {
    insertLaw(db, 100001);
    insertLaw(db, 100002);
    insertRelation(db, 100002, 100001);
    insertRelation(db, 100001, 100008); // orphan
    db.exec(MIGRATION_SQL);
    const afterFirst = edges(db);
    expect(afterFirst).toEqual(['100002>100001:COROLLARY_OF']);
    expect(() => db.exec(MIGRATION_SQL)).not.toThrow();
    expect(edges(db)).toEqual(afterFirst);
  });
});

// Production applies migrations through the real runner: the sqlite3 CLI, wrapped in the runner's own transaction, with
// foreign keys not enforced. This applies 024 that way, on a database already migrated up to 023.
describe('migration 024 through the migration runner', () => {
  let directory: string;
  let migrationsDir: string;
  let dbFile: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'migration-024-test-'));
    migrationsDir = join(directory, 'migrations');
    mkdirSync(migrationsDir);
    dbFile = join(directory, 'test.db');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f < MIGRATION_FILE)) {
      copyFileSync(join(MIGRATIONS_DIR, file), join(migrationsDir, file));
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('removes only the orphans, records itself, and is skipped on the next run', () => {
    migrate(dbFile, migrationsDir);

    const seed = new Database(dbFile);
    seed.pragma('foreign_keys = OFF');
    insertLaw(seed, 100001);
    insertLaw(seed, 100002);
    insertRelation(seed, 100002, 100001);
    insertRelation(seed, 100003, 100001);
    insertRelation(seed, 100002, 100004, 'COMMENT_ON');
    seed.close();

    copyFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), join(migrationsDir, MIGRATION_FILE));
    migrate(dbFile, migrationsDir);
    migrate(dbFile, migrationsDir);

    const check = new Database(dbFile, { readonly: true });
    try {
      expect(edges(check)).toEqual(['100002>100001:COROLLARY_OF']);
      const applied = (check.prepare('SELECT filename FROM schema_migrations WHERE filename = ?').all(MIGRATION_FILE) as Array<{ filename: string }>);
      expect(applied).toHaveLength(1);
    } finally {
      check.close();
    }
  });
});
