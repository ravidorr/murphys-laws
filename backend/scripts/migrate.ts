#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDatabasePath } from '../src/utils/database-path.ts';
import { migrate } from './migration-runner.ts';

// Always migrates: no "run as main" check, which could turn a differently spelled invocation into a silent no-op.
// MURPHYS_DB_PATH (a file that must exist) selects another database; otherwise backend/murphys.db.
// A failure (a migration that fails, or a MURPHYS_DB_PATH that names no database) is reported as one clear message
// and a non-zero exit, so the deploy stops before it goes on with a half-migrated database.
try {
  migrate(resolveDatabasePath(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'murphys.db')));
} catch (err) {
  console.error(`\nMigration failed.\n${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
