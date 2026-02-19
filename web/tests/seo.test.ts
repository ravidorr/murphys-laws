import { truncateTitle } from '../src/utils/seo.ts';

describe('SEO utilities', () => {
  describe('truncateTitle', () => {
    // Default suffix is " - Murphy's Law Archive" (23 chars)
    // Max total length is 60 chars (reduced from 70 for better SERP display)
    // So max title length is 37 chars
    const localThis: { maxTitleLength: number; defaultSuffix: string } = {
      maxTitleLength: 37,
      defaultSuffix: " - Murphy's Law Archive",
    };

    it('returns title unchanged when under max length', () => {
      const title = "Murphy's Laws"; // 13 chars
      const result = truncateTitle(title);
      expect(result).toBe(title);
    });

    it('returns title unchanged when exactly at max length', () => {
      // Create a title exactly 37 chars long
      const title = "Murphy's Laws of Something Really ZZZ"; // 37 chars
      expect(title.length).toBe(localThis.maxTitleLength);
      const result = truncateTitle(title);
      expect(result).toBe(title);
    });

    it('truncates title when over max length', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws"; // 53 chars
      expect(title.length).toBeGreaterThan(localThis.maxTitleLength);
      const result = truncateTitle(title);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length + localThis.defaultSuffix.length).toBeLessThanOrEqual(60);
    });

    it('truncates at word boundary when possible', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws";
      const result = truncateTitle(title);
      // Should not cut in the middle of a word - truncates at trailing space boundary
      expect(result).toBe("Murphy's Role-Playing by Internet...");
    });

    it('keeps total length under 60 chars with default suffix', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws";
      const result = truncateTitle(title);
      const totalLength = result.length + localThis.defaultSuffix.length;
      expect(totalLength).toBeLessThanOrEqual(60);
    });

    it('handles custom suffix length', () => {
      const title = "Murphy's Role-Playing by Internet Laws"; // 39 chars
      const customSuffix = " | Site"; // 7 chars
      const result = truncateTitle(title, customSuffix);
      // Max title length = 60 - 7 = 53 chars
      // Title is 39 chars, so no truncation needed
      expect(result).toBe(title);
    });

    it('truncates with custom suffix when needed', () => {
      const title = "This is a very long title that will definitely need to be truncated for SEO";
      const customSuffix = " | Site"; // 7 chars, max title = 53 chars
      const result = truncateTitle(title, customSuffix);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length + customSuffix.length).toBeLessThanOrEqual(60);
    });

    it('handles short titles', () => {
      const title = "Laws";
      const result = truncateTitle(title);
      expect(result).toBe(title);
    });

    it('handles single word long titles', () => {
      // A very long single word - should still truncate even without word boundary
      const title = "Supercalifragilisticexpialidociouslawsofmurphy12345";
      const result = truncateTitle(title);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length + localThis.defaultSuffix.length).toBeLessThanOrEqual(60);
    });

    it('preserves apostrophes and special characters', () => {
      const title = "Murphy's Laws";
      const result = truncateTitle(title);
      expect(result).toContain("'");
    });
  });
});
