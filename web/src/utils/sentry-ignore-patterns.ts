/**
 * Error message patterns that Sentry should ignore (not our code).
 * Only extension errors are ignored; add other patterns back if Sentry noise returns.
 * Used by main.ts beforeSend. Exported for unit tests.
 */

export const SENTRY_IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Browser extension errors (not our code)
  /runtime\.sendMessage/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Object Not Found Matching Id/i, // LastPass, Grammarly, and similar extensions
];

/**
 * Returns true if the error message should be dropped from Sentry.
 */
export function isSentryErrorIgnored(errorMessage: string): boolean {
  return SENTRY_IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}
