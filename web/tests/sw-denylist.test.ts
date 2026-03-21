import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the navigateFallbackDenylist regex used in vite.config.ts.
 *
 * The service worker must NOT serve index.html for static files like /llms.txt,
 * /robots.txt, /openapi.json, or sitemaps — those must pass through to the
 * real files. SPA routes like /favorites or /law/123 must still get index.html.
 *
 * Keep this in sync with the regex in workbox.navigateFallbackDenylist.
 */
const STATIC_FILE_PATTERN = /^\/[^/]+\.(txt|xml|json|rss|atom)(\?.*)?$/;
const API_PATTERN = /^\/api\//;

const shouldDeny = (url: string) => STATIC_FILE_PATTERN.test(url) || API_PATTERN.test(url);

describe('navigateFallbackDenylist', () => {
  describe('static files — should be denied (served as-is)', () => {
    it.each([
      '/llms.txt',
      '/robots.txt',
      '/sitemap.xml',
      '/image-sitemap.xml',
      '/openapi.json',
      '/feed.rss',
      '/feed.atom',
      '/sitemap.xml?v=2',
    ])('%s', (url) => {
      expect(shouldDeny(url)).toBe(true);
    });
  });

  describe('API routes — should be denied (handled by backend)', () => {
    it.each([
      '/api/v1/laws',
      '/api/v1/laws/random',
      '/api/v1/openapi.json',
      '/api/health',
    ])('%s', (url) => {
      expect(shouldDeny(url)).toBe(true);
    });
  });

  describe('SPA routes — should NOT be denied (get index.html fallback)', () => {
    it.each([
      '/',
      '/favorites',
      '/browse',
      '/law/123',
      '/categories',
      '/categories/technology',
      '/about',
      '/submit',
      '/origin-story',
    ])('%s', (url) => {
      expect(shouldDeny(url)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('does not deny a path segment containing a dot that is not a file extension', () => {
      // /v1.0/something is a nested path, not a root-level static file
      expect(STATIC_FILE_PATTERN.test('/v1.0/something')).toBe(false);
    });

    it('does not deny nested paths even if they end in a known extension', () => {
      // /assets/data.json is a nested path — precached assets, not root static files
      expect(STATIC_FILE_PATTERN.test('/assets/data.json')).toBe(false);
    });
  });
});
