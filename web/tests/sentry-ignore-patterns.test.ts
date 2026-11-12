import { inboundFiltersIntegration } from '@sentry/browser';
import { isSentryErrorIgnored, isInjectedScriptStackOverflow, SENTRY_DENIED_URLS, SENTRY_IGNORED_ERROR_PATTERNS } from '../src/utils/sentry-ignore-patterns.ts';

describe('sentry-ignore-patterns', () => {
  describe('isSentryErrorIgnored', () => {
    it('returns true for browser extension errors', () => {
      expect(isSentryErrorIgnored('chrome-extension://abc123 something failed')).toBe(true);
      expect(isSentryErrorIgnored('runtime.sendMessage error')).toBe(true);
      expect(isSentryErrorIgnored('moz-extension://xyz error')).toBe(true);
      expect(isSentryErrorIgnored('Object Not Found Matching Id')).toBe(true);
    });

    it('returns true for webkit messageHandlers probe errors', () => {
      expect(isSentryErrorIgnored("undefined is not an object (evaluating 'window.webkit.messageHandlers')")).toBe(true);
    });

    it('returns true for Android WebView JS-to-Java bridge teardown errors (e.g. Facebook in-app browser)', () => {
      expect(isSentryErrorIgnored('Error invoking enableDidUserTypeOnKeyboardLogging: Java object is gone')).toBe(true);
      expect(isSentryErrorIgnored('Error invoking someMethod: Java object is gone')).toBe(true);
    });

    it('returns true for Sentry SDK internal pageObserver error', () => {
      expect(isSentryErrorIgnored("feature named `pageObserver` was not found")).toBe(true);
      expect(isSentryErrorIgnored("feature named 'pageObserver' was not found")).toBe(true);
      expect(isSentryErrorIgnored('feature named pageObserver was not found')).toBe(true);
    });

    it('returns true for GA gtag unhandled rejection with undefined value', () => {
      expect(isSentryErrorIgnored('Non-Error promise rejection captured with value: undefined')).toBe(true);
    });

    it('returns true for cross-browser fetch transport rejections from disconnected clients', () => {
      // Chrome / Edge
      expect(isSentryErrorIgnored('Failed to fetch')).toBe(true);
      // Firefox
      expect(isSentryErrorIgnored('NetworkError when attempting to fetch resource.')).toBe(true);
      // Safari
      expect(isSentryErrorIgnored('Load failed')).toBe(true);
    });

    it('returns true for native fetch timeout and cancellation messages', () => {
      expect(isSentryErrorIgnored('signal timed out')).toBe(true);
      expect(isSentryErrorIgnored('TimeoutError: signal timed out')).toBe(true);
      expect(isSentryErrorIgnored('The user aborted a request.')).toBe(true);
      expect(isSentryErrorIgnored('AbortError: The user aborted a request.')).toBe(true);
    });

    it('returns false for application errors', () => {
      expect(isSentryErrorIgnored('Cannot read property "x" of undefined')).toBe(false);
      // Generic-sounding strings that should NOT be swept up by the fetch-transport patterns
      expect(isSentryErrorIgnored('Failed to fetch laws from upstream cache')).toBe(false);
      expect(isSentryErrorIgnored('Network request failed')).toBe(false);
      expect(isSentryErrorIgnored('Service worker registration failed')).toBe(false);
      expect(isSentryErrorIgnored('Importing a module script failed')).toBe(false);
      expect(isSentryErrorIgnored('signal timed out while loading application state')).toBe(false);
      expect(isSentryErrorIgnored('The user aborted a request to save changes.')).toBe(false);
    });
  });

  describe('headless crawler environment', () => {
    it('drops the queueMicrotask ReferenceError thrown by the SDK in stripped-down crawlers', () => {
      expect(isSentryErrorIgnored('queueMicrotask is not defined')).toBe(true);
    });

    it('keeps other undefined-identifier ReferenceErrors', () => {
      expect(isSentryErrorIgnored('fetchLaw is not defined')).toBe(false);
    });
  });

  describe('browsing context teardown', () => {
    it('drops the iOS Safari AbortError raised while the page is going away', () => {
      expect(isSentryErrorIgnored('Promise was rejected because the browsing context is going away')).toBe(true);
    });

    it('keeps other AbortErrors', () => {
      expect(isSentryErrorIgnored('The operation was aborted.')).toBe(false);
    });
  });

  describe('isInjectedScriptStackOverflow', () => {
    const overflow = 'Maximum call stack size exceeded.';
    const documents = ['/examples', 'https://murphys-laws.com/examples'];
    const documentFrames = [{ filename: '/examples' }, { filename: '/examples' }];

    it('returns true when every frame is the current HTML document', () => {
      expect(isInjectedScriptStackOverflow(overflow, documentFrames, documents)).toBe(true);
      expect(isInjectedScriptStackOverflow('Maximum call stack size exceeded', documentFrames, documents)).toBe(true);
    });

    it('matches the document by full URL and ignores query and hash', () => {
      expect(isInjectedScriptStackOverflow(overflow, [
        { filename: 'https://murphys-laws.com/examples?utm=x#top' },
        { filename: '/examples?utm=x' },
      ], documents)).toBe(true);
    });

    it('returns false when a frame has no filename', () => {
      expect(isInjectedScriptStackOverflow(overflow, [{}], documents)).toBe(false);
      expect(isInjectedScriptStackOverflow(overflow, [{ filename: '/examples' }, { filename: '' }], documents)).toBe(false);
    });

    it('returns false when a frame comes from any other URL', () => {
      expect(isInjectedScriptStackOverflow(overflow, [
        { filename: '/examples' },
        { filename: '/assets/index-abc123.js' },
      ], documents)).toBe(false);
      expect(isInjectedScriptStackOverflow(overflow, [{ filename: '../../src/router.ts' }], documents)).toBe(false);
      expect(isInjectedScriptStackOverflow(overflow, [{ filename: 'https://murphys-laws.com/bundle' }], documents)).toBe(false);
      expect(isInjectedScriptStackOverflow(overflow, [{ filename: '/browse' }], documents)).toBe(false);
    });

    it('returns false when there are no frames', () => {
      expect(isInjectedScriptStackOverflow(overflow, [], documents)).toBe(false);
    });

    it('returns false for other errors', () => {
      expect(isInjectedScriptStackOverflow('Cannot read properties of undefined', documentFrames, documents)).toBe(false);
    });
  });

  describe('SENTRY_DENIED_URLS', () => {
    const isDenied = (url: string): boolean => SENTRY_DENIED_URLS.some((pattern) => pattern.test(url));

    it('denies the Startpage proxy copy of gtag.js that threw JAVASCRIPT-1B', () => {
      expect(isDenied('https://av-eu1.startpage.com/__av/AWrpspOp1zpUkObd87LbYfl4iQXaaHR0cHM6Ly93d3cuZ29vZ2xldGFnbWFuYWdlci5jb20vZ3RhZy9qcz9pZD1HLVhHN0c2S1JQMEU')).toBe(true);
      expect(isDenied('https://startpage.com/__av/x')).toBe(true);
      expect(isDenied('http://www.startpage.com/script.js')).toBe(true);
    });

    it('keeps our own scripts and look-alike hosts', () => {
      expect(isDenied('https://murphys-laws.com/assets/index-abc123.js')).toBe(false);
      expect(isDenied('https://www.googletagmanager.com/gtag/js?id=G-XG7G6KRP0E')).toBe(false);
      expect(isDenied('https://notstartpage.com/x.js')).toBe(false);
      expect(isDenied('https://startpage.com.evil.example/x.js')).toBe(false);
      expect(isDenied('https://murphys-laws.com/search?q=startpage.com/')).toBe(false);
    });

    describe('with the Sentry inbound filter', () => {
      const startpageUrl = 'https://av-eu1.startpage.com/__av/AWrpspOp1zpUkObd87LbYfl4iQXaaHR0cHM6Ly93d3cuZ29vZ2xldGFnbWFuYWdlci5jb20vZ3RhZy9qcz9pZD1HLVhHN0c2S1JQMEU';
      const filter = (frames: Array<{ filename: string; function: string }>) => {
        const event = {
          exception: {
            values: [{ type: 'TypeError', value: 'Can only call Window.setInterval on instances of Window', stacktrace: { frames } }],
          },
        };
        const client = { getOptions: () => ({ denyUrls: SENTRY_DENIED_URLS }) };
        // Sentry's own inbound-filter integration, configured the way main.ts configures denyUrls.
        const integration = inboundFiltersIntegration() as unknown as {
          processEvent: (event: unknown, hint: unknown, client: unknown) => unknown;
        };
        return integration.processEvent(event, {}, client);
      };

      it('drops an event whose innermost non-native frame is the Startpage copy of gtag.js', () => {
        // Sentry orders frames oldest first, so the native setInterval call that threw is last.
        expect(filter([
          { filename: startpageUrl, function: 'global code' },
          { filename: startpageUrl, function: 'ld' },
          { filename: '[native code]', function: 'setInterval' },
        ])).toBeNull();
      });

      it('keeps an event thrown from our own bundle', () => {
        expect(filter([
          { filename: 'https://murphys-laws.com/assets/index-abc123.js', function: 'start' },
          { filename: '[native code]', function: 'setInterval' },
        ])).not.toBeNull();
      });
    });

    it('still denies the ad script hosts', () => {
      expect(isDenied('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).toBe(true);
      expect(isDenied('https://securepubads.g.doubleclick.net/tag/js/gpt.js')).toBe(true);
      expect(isDenied('https://www.googleadservices.com/pagead/conversion.js')).toBe(true);
    });
  });

  describe('SENTRY_IGNORED_ERROR_PATTERNS', () => {
    it('has the expected number of patterns', () => {
      expect(SENTRY_IGNORED_ERROR_PATTERNS.length).toBe(16);
      expect(SENTRY_IGNORED_ERROR_PATTERNS.some((p) => p.test('chrome-extension://x'))).toBe(true);
    });
  });
});
