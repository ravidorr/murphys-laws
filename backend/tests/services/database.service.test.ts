import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../../src/services/database.service.ts';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('DatabaseService', () => {
  it('should connect when given :memory: path', () => {
    const service = new DatabaseService(':memory:');
    const row = service.prepare('SELECT 1 AS x').get() as { x: number };
    expect(row).toEqual({ x: 1 });
  });

  it('should return row from prepare().get()', () => {
    const service = new DatabaseService(':memory:');
    const result = service.prepare('SELECT 1 AS x').get() as { x: number };
    expect(result).toEqual({ x: 1 });
  });

  it('should run transaction and return value', () => {
    const service = new DatabaseService(':memory:');
    const run = service.transaction(() => 42);
    expect(run()).toBe(42);
  });

  it('should persist data written inside transaction', () => {
    const path = join(tmpdir(), `db-test-${Date.now()}.db`);
    const service = new DatabaseService(path);
    const run = service.transaction(() => {
      service.prepare('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)').run();
      service.prepare('INSERT INTO t (id, val) VALUES (1, ?)').run('hello');
    });
    run();
    const row = service.prepare('SELECT id, val FROM t WHERE id = 1').get() as { id: number; val: string };
    expect(row).toEqual({ id: 1, val: 'hello' });
  });
});
