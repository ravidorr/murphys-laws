import { describe, it, expect, afterEach, vi } from 'vitest';
import { applyLegacyDisplayClass, isKindleBrowser } from '../src/utils/legacy-display.ts';

describe('isKindleBrowser', () => {
  it('matches Kindle and Silk user agents', () => {
    expect(isKindleBrowser('Mozilla/5.0 (Linux; Android) Kindle/3.0')).toBe(true);
    expect(isKindleBrowser('Mozilla/5.0 Silk/120.0')).toBe(true);
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
    applyLegacyDisplayClass(document, 'Mozilla/5.0 Kindle');
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
