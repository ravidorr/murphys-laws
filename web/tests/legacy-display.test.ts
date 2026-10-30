import { describe, it, expect, afterEach, vi } from 'vitest';
import { applyLegacyDisplayClass, isKindleBrowser } from '../src/utils/legacy-display.ts';

describe('isKindleBrowser', () => {
  it('matches the e-ink Kindle user agent', () => {
    expect(isKindleBrowser('Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+')).toBe(true);
    expect(isKindleBrowser('Mozilla/5.0 (Linux; Android) Kindle/3.0')).toBe(true);
  });

  it('does not match Fire tablets (Silk)', () => {
    expect(isKindleBrowser('Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.0 like Chrome/120.0 Safari/537.36')).toBe(false);
    expect(isKindleBrowser('Mozilla/5.0 (Linux; U; Android 2.3.4; en-us; Kindle Fire Build/GINGERBREAD) AppleWebKit/533.1')).toBe(false);
  });

  it('does not match other browsers', () => {
    expect(isKindleBrowser('Mozilla/5.0 Chrome/120 Safari/537.36')).toBe(false);
  });

  it('reads navigator.userAgent by default', () => {
    expect(isKindleBrowser()).toBe(false);
  });

  it('is false when there is no navigator', () => {
    vi.stubGlobal('navigator', undefined);
    try {
      expect(isKindleBrowser()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('applyLegacyDisplayClass', () => {
  afterEach(() => {
    document.documentElement.classList.remove('legacy-display');
  });

  it('adds the class on Kindle', () => {
    applyLegacyDisplayClass(document, 'Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) Kindle/3.0+');
    expect(document.documentElement.classList.contains('legacy-display')).toBe(true);
  });

  it('leaves the page alone on other browsers', () => {
    applyLegacyDisplayClass(document, 'Mozilla/5.0 Chrome/120');
    expect(document.documentElement.classList.contains('legacy-display')).toBe(false);
  });

  it('defaults to the current document and user agent', () => {
    applyLegacyDisplayClass();
    expect(document.documentElement.classList.contains('legacy-display')).toBe(false);
  });
});
