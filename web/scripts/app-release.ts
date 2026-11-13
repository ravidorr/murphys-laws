// The release the web build is made for: one string, derived from the commit, never from the clock.
//
// It is compiled into the bundle (Sentry.init `release`, through the `define` in vite.config.ts) and handed to the
// Sentry plugin that uploads the source maps, so events from the browser and the uploaded maps carry the same name.
// A timestamp here would change the entry chunk on every build, so building one commit twice gave two sets of file
// names. With the commit as the release, one commit always builds the same bundle. A new commit still renames the
// entry chunks (the release is part of them); the polyfills and the stylesheet keep their names.
import { execFileSync } from 'node:child_process';

// A release name is a path segment in Sentry's API: no slashes, whitespace or newlines, not `latest`, at most 200
// characters. This allowlist is stricter than that (it starts with a letter or digit, which also rules out `.` and `..`).
const RELEASE_NAME = /^(?!latest$)[A-Za-z0-9][A-Za-z0-9._+@-]{0,199}$/;
const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/; // SHA-1, or SHA-256 for a repository made with it

export interface AppReleaseInput {
  /**
   * The build environment; VITE_APP_VERSION (the commit SHA in CI) wins when it is set. This is the process
   * environment of the shell or the CI job, not `web/.env`.
   */
  env: Record<string, string | undefined>;
  /** The version in the root package.json, used for the fallback of a checkout without git. */
  packageVersion: string;
  /** Returns the commit the working tree is at, or undefined when git cannot say. */
  readGitSha?: () => string | undefined;
  /** Refuse the `-dev` fallback (for a build that is set to upload source maps: one shared release name would mix builds). */
  requireCommit?: boolean;
  /** Where the warning about the `-dev` fallback goes. */
  warn?: (message: string) => void;
}

/** The commit of the checkout at `cwd`, or undefined when git is missing or the directory is not a repository. */
export function readGitSha(cwd: string = process.cwd()): string | undefined {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return GIT_SHA.test(sha) ? sha : undefined;
  } catch {
    // No git binary, not a repository (a source archive), an unreadable one (git refuses a checkout owned by another
    // user) or no answer in time: the caller falls back to the package version, and says so.
    return undefined;
  }
}

/**
 * VITE_APP_VERSION when set, else the commit of the checkout, else `<package version>-dev` (with a warning, or an
 * error when `requireCommit` is set).
 * An invalid VITE_APP_VERSION stops the build: Sentry would reject the name, and a value set on purpose is not
 * replaced silently by another one.
 */
export function resolveAppRelease({
  env,
  packageVersion,
  readGitSha: readSha = readGitSha,
  requireCommit = false,
  warn = console.warn,
}: AppReleaseInput): string {
  const configured = env.VITE_APP_VERSION?.trim();
  if (configured) {
    if (!RELEASE_NAME.test(configured)) {
      throw new Error(
        `VITE_APP_VERSION "${configured}" is not a valid release name: start with a letter or digit, then use letters, digits and . _ + @ - (up to 200 characters, not "latest").`,
      );
    }
    return configured;
  }
  const sha = readSha();
  if (sha) return sha;
  const fallback = `${packageVersion}-dev`;
  const reason = `VITE_APP_VERSION is not set and git could not report the commit, so the release would be "${fallback}"`;
  if (requireCommit) {
    throw new Error(`${reason}: set VITE_APP_VERSION to the commit SHA for a build that uploads source maps.`);
  }
  warn(`[app-release] ${reason}.`);
  return fallback;
}
