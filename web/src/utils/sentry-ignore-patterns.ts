/**
 * Error message patterns that Sentry should ignore (not application bugs).
 * Used by main.ts beforeSend. Exported for unit tests.
 */

export const SENTRY_IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Browser extension errors (not our code)
  /runtime\.sendMessage/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Object Not Found Matching Id/i, // LastPass, Grammarly, and similar extensions
  // Module import failures (transient network/cache issues)
  /Importing a module script failed/i,
  // Service worker errors (transient browser state issues, crawlers, network)
  /Service worker registration failed/i,
  /Failed to register a ServiceWorker/i,
  /Failed to update a ServiceWorker/i,
  /error occurred when fetching the script/i,
  /The object is in an invalid state/i,
  /newestWorker is null/i,
  // Sentry SDK / third-party: feature lookup for "performanceMetrics" not found (not our feature flags)
  /feature named `performanceMetrics` was not found/i,
];

/**
 * Returns true if the error message should be dropped from Sentry.
 */
export function isSentryErrorIgnored(errorMessage: string): boolean {
  return SENTRY_IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}
