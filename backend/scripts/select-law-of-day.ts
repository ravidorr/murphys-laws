#!/usr/bin/env node
/**
 * Picks today's (UTC) Law of the Day, so it is already chosen when the first visitor of the day arrives instead
 * of being picked by that visitor's request.
 *
 * Run once a day at 00:00 UTC from cron: backend/config/cron.d/murphys-laws-law-of-day is the schedule and the
 * deploy installs it (see shared/docs/DEPLOYMENT.md). It uses the same LawService method as the API, so it is
 * safe to run at any time and any number of times, also while the API serves requests: only one live pick is
 * made per UTC day (a replacement is added only when that law was unpublished), and a run that finds the day already picked says so and changes nothing. Exits non-zero when
 * there is no published law to pick or the database cannot be used, so the log shows the failure.
 */
import { existsSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from '../src/services/database.service.ts';
import { LawService } from '../src/services/laws.service.ts';
import { resolveDatabasePath } from '../src/utils/database-path.ts';

type LogFn = (message: string) => void;

export interface RunSelectLawOfDayOptions {
  now?: () => Date;
  log?: LogFn;
  logError?: LogFn;
}

/** Picks today's law and logs what happened, one timestamped line each. Returns the process exit code. */
export function runSelectLawOfDay(
  lawService: Pick<LawService, 'selectLawOfTheDay'>,
  { now = () => new Date(), log = console.log, logError = console.error }: RunSelectLawOfDayOptions = {},
): number {
  const stamp = (message: string): string => `[${now().toISOString()}] [Law of the Day] ${message}`;
  const pick = lawService.selectLawOfTheDay(now().toISOString().split('T')[0]);

  if (!pick) {
    logError(stamp('ERROR: no published law to pick from'));
    return 1;
  }

  log(stamp(pick.created
    ? `Picked law ${pick.lawId} for ${pick.featuredDate}`
    : `Already picked for ${pick.featuredDate}: law ${pick.lawId}`));
  return 0;
}

function main(): number {
  // The same file the API opens, found the same way (MURPHYS_DB_PATH is not set in production)
  const dbPath = resolveDatabasePath(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'murphys.db'));
  // Opening a missing file would create an empty database (owned by whoever runs the job) and fail later on a missing table
  if (!existsSync(dbPath)) {
    throw new Error(`the database ${dbPath} does not exist`);
  }
  const db = (new DatabaseService(dbPath) as unknown as { db: ConstructorParameters<typeof LawService>[0] }).db;
  return runSelectLawOfDay(new LawService(db));
}

// Both sides resolved, so a symlinked path to the script cannot turn the run into a silent no-op
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Law of the Day] ERROR:`, error);
    process.exitCode = 1;
  }
}
