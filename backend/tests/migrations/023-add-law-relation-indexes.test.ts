import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMigratedDb } from '../helpers/migrated-db.ts';

const MIGRATION_SQL = readFileSync(
  join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), 'db', 'migrations', '023_add_law_relation_indexes.sql'),
  'utf8'
);

type Db = ReturnType<typeof createMigratedDb>;

interface IndexRow { name: string; unique: number }

describe('migration 023: law_relations indexes', () => {
  let db: Db;

  /** Indexes on law_relations that migrations created, with their columns in order. */
  const indexes = (): Record<string, { unique: boolean; columns: string[] }> => {
    const result: Record<string, { unique: boolean; columns: string[] }> = {};
    const rows = db.prepare("SELECT name, \"unique\" AS \"unique\" FROM pragma_index_list('law_relations') WHERE origin = 'c'").all() as IndexRow[];
    for (const row of rows) {
      const columns = (db.prepare('SELECT name FROM pragma_index_info(?) ORDER BY seqno').all(row.name) as Array<{ name: string }>).map((c) => c.name);
      result[row.name] = { unique: row.unique === 1, columns };
    }
    return result;
  };

  beforeEach(() => { db = createMigratedDb({ before: '023' }); });
  afterEach(() => { db.close(); });

  it('creates both indexes, non-unique, on (from_law_id, relation_type) and (to_law_id, relation_type)', () => {
    expect(indexes()).toEqual({});
    db.exec(MIGRATION_SQL);
    expect(indexes()).toEqual({
      idx_law_relations_from: { unique: false, columns: ['from_law_id', 'relation_type'] },
      idx_law_relations_to: { unique: false, columns: ['to_law_id', 'relation_type'] }
    });
  });

  it('is safe to run twice', () => {
    db.exec(MIGRATION_SQL);
    expect(() => db.exec(MIGRATION_SQL)).not.toThrow();
    expect(Object.keys(indexes()).sort()).toEqual(['idx_law_relations_from', 'idx_law_relations_to']);
  });

  it('applies on top of existing duplicate edges because no unique index is created', () => {
    db.prepare('INSERT INTO laws (id, text, status, first_seen_file_path) VALUES (?, ?, ?, ?)').run(100001, 'Parent law text here.', 'published', 'a.md');
    db.prepare('INSERT INTO laws (id, text, status, first_seen_file_path) VALUES (?, ?, ?, ?)').run(100002, 'Child law text here.', 'published', 'b.md');
    const insert = db.prepare("INSERT INTO law_relations (from_law_id, to_law_id, relation_type) VALUES (100002, 100001, 'COROLLARY_OF')");
    insert.run();
    insert.run();
    expect(() => db.exec(MIGRATION_SQL)).not.toThrow();
    expect((db.prepare('SELECT COUNT(*) AS n FROM law_relations').get() as { n: number }).n).toBe(2);
  });

  it('is part of the full migration set, and the planner uses the new indexes', () => {
    const full = createMigratedDb();
    try {
      const names = (full.prepare("SELECT name FROM pragma_index_list('law_relations') WHERE origin = 'c'").all() as Array<{ name: string }>)
        .map((r) => r.name)
        .sort();
      expect(names).toEqual(['idx_law_relations_from', 'idx_law_relations_to']);
      const plan = (sql: string): string =>
        (full.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>).map((r) => r.detail).join('\n');
      expect(plan("SELECT 1 FROM law_relations WHERE to_law_id = 1 AND relation_type = 'COROLLARY_OF'")).toContain('idx_law_relations_to');
      expect(plan("SELECT 1 FROM law_relations WHERE from_law_id = 1 AND relation_type = 'COROLLARY_OF'")).toContain('idx_law_relations_from');
    } finally {
      full.close();
    }
  });
});
