import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');

export interface MigratedDbOptions {
  /** A file to create instead of an in-memory database. */
  path?: string;
  /** Stop before the first migration whose filename starts with this prefix (for a database one migration behind). */
  before?: string;
}

/** In-memory database built from the real migrations, so tests run against the production schema. */
export function createMigratedDb(options: MigratedDbOptions = {}): InstanceType<typeof Database> {
  const db = new Database(options.path ?? ':memory:');
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (options.before !== undefined && file >= options.before) break;
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}
