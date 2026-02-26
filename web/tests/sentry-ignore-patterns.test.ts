import { isSentryErrorIgnored, SENTRY_IGNORED_ERROR_PATTERNS } from '../src/utils/sentry-ignore-patterns.ts';

describe('sentry-ignore-patterns', () => {
  describe('isSentryErrorIgnored', () => {
    it('returns true for browser extension errors', () => {
      expect(isSentryErrorIgnored('chrome-extension://abc123 something failed')).toBe(true);
      expect(isSentryErrorIgnored('runtime.sendMessage error')).toBe(true);
      expect(isSentryErrorIgnored('moz-extension://xyz error')).toBe(true);
      expect(isSentryErrorIgnored('Object Not Found Matching Id')).toBe(true);
    });

    it('returns false for application errors', () => {
      expect(isSentryErrorIgnored('Cannot read property "x" of undefined')).toBe(false);
      expect(isSentryErrorIgnored('Network request failed')).toBe(false);
      expect(isSentryErrorIgnored('Service worker registration failed')).toBe(false);
      expect(isSentryErrorIgnored('Importing a module script failed')).toBe(false);
    });
  });

  describe('SENTRY_IGNORED_ERROR_PATTERNS', () => {
    it('includes only extension-related patterns', () => {
      expect(SENTRY_IGNORED_ERROR_PATTERNS.length).toBe(5);
      expect(SENTRY_IGNORED_ERROR_PATTERNS.some((p) => p.test('chrome-extension://x'))).toBe(true);
    });
  });
});
