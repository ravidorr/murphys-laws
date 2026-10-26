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
  // A blank value counts as unset: `EMAIL_TO` can be written empty by the deploy, and a hand-edited .env can
  // hold an empty or whitespace-only value.
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/**
 * Splits a recipient setting into addresses: one address or a comma-separated list ("a@example.com, b@example.com"),
 * spaces around the commas ignored. Every address is checked the way alert-email.sh checks them (must
 * contain an @, no whitespace inside, must not start with "-", which a mail program would read as an
 * option). Throws, naming the bad entry, so a script stops with a clear message instead of handing a bad
 * address to nodemailer or sendmail.
 */
export function parseRecipientList(value: string): string[] {
  const recipients: string[] = [];
  for (const entry of value.split(',')) {
    const address = entry.trim();
    if (!address) {
      continue;
    }
    if (address.startsWith('-') || /\s/.test(address) || !address.includes('@')) {
      throw new Error(`'${address}' is not a valid email address (in the recipient setting '${value}')`);
    }
    recipients.push(address);
  }
  if (recipients.length === 0) {
    throw new Error(`'${value}' holds no email address`);
  }
  return recipients;
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
    .flatMap((envFile) => {
      try {
        return [dotenv.parse(readFileSync(envFile))];
      } catch (error) {
        // An unreadable file (a directory, no permission) is skipped, as alert-email.sh skips it, instead of
        // crashing a monitor; say so, because the recipient may then come from another file.
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`WARNING: cannot read ${envFile} for the alert recipient (${reason}); skipping it`);
        return [];
      }
    });

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
