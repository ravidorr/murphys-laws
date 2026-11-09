import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** Environment variable that points the API and the migration script at another SQLite file. */
export const DATABASE_PATH_ENV = 'MURPHYS_DB_PATH';

/**
 * The SQLite file to open: the one named by `MURPHYS_DB_PATH` (resolved against the working directory) when it is
 * set to a non-blank value, otherwise `defaultPath`. The deploy uses the override to prerender the site from a
 * sanitized copy of the production data; production itself never sets it, so its file does not change.
 *
 * An override must name an existing, non-empty file: SQLite would otherwise create a new database there and the
 * migrations would seed it with a hundred laws, which a build could then publish as if it were production.
 */
export function resolveDatabasePath(defaultPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[DATABASE_PATH_ENV]?.trim();
  if (!override) return defaultPath;
  const path = resolve(override);
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
    throw new Error(`${DATABASE_PATH_ENV} must name an existing, non-empty database file (got ${path})`);
  }
  return path;
}
