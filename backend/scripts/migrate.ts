#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDatabasePath } from '../src/utils/database-path.ts';
import { migrate } from './migration-runner.ts';

// Always migrates: no "run as main" check, which could turn a differently spelled invocation into a silent no-op.
// MURPHYS_DB_PATH (a file that must exist) selects another database; otherwise backend/murphys.db.
migrate(resolveDatabasePath(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'murphys.db')));
