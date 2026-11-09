import { resolve } from 'node:path';

/** Environment variable that points the API and the migration script at another SQLite file. */
export const DATABASE_PATH_ENV = 'MURPHYS_DB_PATH';

/**
 * The SQLite file to open: the one named by `MURPHYS_DB_PATH` (resolved against the working directory) when it is
 * set to a non-blank value, otherwise `defaultPath`. The deploy uses the override to prerender the site from a
 * sanitized copy of the production data; production itself never sets it, so its file does not change.
 */
export function resolveDatabasePath(defaultPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[DATABASE_PATH_ENV]?.trim();
  return override ? resolve(override) : defaultPath;
}
