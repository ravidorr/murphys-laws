import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/** Where operational email goes unless a script has its own, narrower setting. */
export const ALERT_RECIPIENT_KEYS = ['ALERT_EMAIL', 'EMAIL_TO'] as const;

/**
 * Who an operational email (health check, daily report) goes to: the first non-blank of `keys`,
 * which default to `ALERT_EMAIL` and then `EMAIL_TO`, the admin address the server already uses for
 * notices. There is no built-in address. Returns null when none is set, and callers treat that as an
 * error (the shell scripts have their own helper, alert-email.sh, which follows the same order).
 */
export function resolveAlertRecipient(
  env: NodeJS.ProcessEnv,
  keys: readonly string[] = ALERT_RECIPIENT_KEYS,
): string | null {
  // A blank value counts as unset: the deploy writes "KEY=" (empty) for a secret that is not set.
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/**
 * Fills each of `keys` that is blank in `env` from the server's .env files, because cron gives scripts
 * no environment. The files are checked in the order alert-email.sh uses: `$ALERT_ENV_FILE` (an extra
 * file for overrides), `<repoRoot>/.env`, then `<repoRoot>/backend/.env`; the first non-blank value wins
 * and a value already set in `env` is never replaced.
 */
export function fillEnvFromFiles(repoRoot: string, env: NodeJS.ProcessEnv, keys: readonly string[]): void {
  const files = [env.ALERT_ENV_FILE?.trim(), path.join(repoRoot, '.env'), path.join(repoRoot, 'backend/.env')]
    .filter((envFile): envFile is string => Boolean(envFile) && existsSync(envFile as string))
    .map((envFile) => dotenv.parse(readFileSync(envFile)));

  for (const key of keys) {
    if (env[key]?.trim()) {
      continue;
    }
    const fromFile = files.map((file) => file[key]).find((value) => value?.trim());
    if (fromFile) {
      env[key] = fromFile;
    }
  }
}
