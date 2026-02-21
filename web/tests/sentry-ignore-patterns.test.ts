import { isSentryErrorIgnored, SENTRY_IGNORED_ERROR_PATTERNS } from '../src/utils/sentry-ignore-patterns.ts';

describe('sentry-ignore-patterns', () => {
  describe('isSentryErrorIgnored', () => {
    it('returns true for performanceMetrics feature not found (Sentry/third-party noise)', () => {
      expect(isSentryErrorIgnored('feature named `performanceMetrics` was not found')).toBe(true);
    });

    it('returns true for browser extension errors', () => {
      expect(isSentryErrorIgnored('chrome-extension://abc123 something failed')).toBe(true);
      expect(isSentryErrorIgnored('runtime.sendMessage error')).toBe(true);
    });

    it('returns true for service worker registration failures', () => {
      expect(isSentryErrorIgnored('Service worker registration failed')).toBe(true);
      expect(isSentryErrorIgnored('Failed to register a ServiceWorker')).toBe(true);
    });

    it('returns true for module script import failures', () => {
      expect(isSentryErrorIgnored('Importing a module script failed')).toBe(true);
    });

    it('returns false for application errors', () => {
      expect(isSentryErrorIgnored('Cannot read property "x" of undefined')).toBe(false);
      expect(isSentryErrorIgnored('Network request failed')).toBe(false);
    });
  });

  describe('SENTRY_IGNORED_ERROR_PATTERNS', () => {
    it('includes pattern for performanceMetrics so that Sentry drops the event', () => {
      const performanceMetricsPattern = SENTRY_IGNORED_ERROR_PATTERNS.find((p) =>
        p.test('feature named `performanceMetrics` was not found')
      );
      expect(performanceMetricsPattern).toBeDefined();
    });
  });
});
