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
  // Fetch transport failures from a disconnected client (offline mobile, captive portal,
  // DNS hiccup, dropped cell signal). Each major engine uses different phrasing for the
  // same underlying TypeError that fetch() rejects with:
  //   Chrome / Edge: "Failed to fetch"
  //   Firefox:       "NetworkError when attempting to fetch resource."
  //   Safari:        "Load failed"
  // These aren't application bugs; views that catch fetch errors and blindly call
  // Sentry.captureException would otherwise flood the dashboard with user-connectivity noise.
  /^Failed to fetch$/,
  /NetworkError when attempting to fetch resource/i,
  /^Load failed$/,
  // Native fetch cancellation messages from browser-enforced request timeouts
  // and navigation/unload. These are expected client transport failures.
  /^(?:TimeoutError: )?signal timed out$/,
  /^(?:AbortError: )?The user aborted a request\.$/,
  // iOS Safari rejects pending promises with this AbortError while the page is being torn
  // down (navigating away after an ad tap, closing the tab). It has no stack frames and
  // nothing the app can catch.
  /^Promise was rejected because the browsing context is going away$/,
];

/**
 * True for a "Maximum call stack size exceeded" RangeError whose frames all come from
 * the HTML document itself (e.g. `/examples:228:409`) and none from a bundled script.
 * That shape comes from code the Google app's iOS in-app browser injects into the page
 * and runs recursively over the DOM; the app's own bundle never appears in these stacks,
 * so a genuine recursion bug in our code is still reported.
 */
export function isInjectedScriptStackOverflow(
  errorMessage: string,
  frames: ReadonlyArray<{ filename?: string }>,
): boolean {
  if (!/^Maximum call stack size exceeded\.?$/i.test(errorMessage) || frames.length === 0) {
    return false;
  }
  return frames.every((frame) => !/\.(?:m?js|ts)(?:[?#]|$)/i.test(frame.filename || ''));
}

/**
 * Returns true if the error message should be dropped from Sentry.
 */
export function isSentryErrorIgnored(errorMessage: string): boolean {
  return SENTRY_IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(errorMessage));
}
