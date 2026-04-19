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
  // Sentry SDK internal error (v10+ browserTracingIntegration bug on some browsers)
  /feature named .?pageObserver.? was not found/i,
  // GA gtag beacon failures reject with undefined (not an Error); no actionable stack trace
  /Non-Error promise rejection captured with value: undefined/i,
  // iOS WebKit bridge probe by ad/analytics scripts (e.g. Google FundingChoices) in non-native browsers
  /window\.webkit\.messageHandlers/i,
  // Android WebView JS-to-Java bridge teardown race on beforeunload (seen in Facebook in-app
  // browser calling its internal enableDidUserTypeOnKeyboardLogging analytics). Not our code.
  /Java object is gone/i,
];

/**
 * Returns true if the error message should be dropped from Sentry.
 */
export function isSentryErrorIgnored(errorMessage: string): boolean {
  return SENTRY_IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}
