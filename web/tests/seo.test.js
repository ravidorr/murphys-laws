import { truncateTitle } from '../src/utils/seo.js';

describe('SEO utilities', () => {
  describe('truncateTitle', () => {
    const localThis = {};

    beforeEach(() => {
      // Default suffix is " - Murphy's Law Archive" (24 chars)
      // Max total length is 70 chars
      // So max title length is 46 chars
      localThis.maxTitleLength = 46;
      localThis.defaultSuffix = " - Murphy's Law Archive";
    });

    it('returns title unchanged when under max length', () => {
      const title = "Murphy's Laws"; // 13 chars
      const result = truncateTitle(title);
      expect(result).toBe(title);
    });

    it('returns title unchanged when exactly at max length', () => {
      // Create a title exactly 46 chars long
      const title = "Murphy's Laws of Something Really Important XY"; // 46 chars
      expect(title.length).toBe(localThis.maxTitleLength);
      const result = truncateTitle(title);
      expect(result).toBe(title);
    });

    it('truncates title when over max length', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws"; // 53 chars
      expect(title.length).toBeGreaterThan(localThis.maxTitleLength);
      const result = truncateTitle(title);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length + localThis.defaultSuffix.length).toBeLessThanOrEqual(70);
    });

    it('truncates at word boundary when possible', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws";
      const result = truncateTitle(title);
      // Should not cut in the middle of a word
      expect(result).toBe("Murphy's Role-Playing by Internet Message...");
    });

    it('keeps total length under 70 chars with default suffix', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws";
      const result = truncateTitle(title);
      const totalLength = result.length + localThis.defaultSuffix.length;
      expect(totalLength).toBeLessThanOrEqual(70);
    });

    it('handles custom suffix length', () => {
      const title = "Murphy's Role-Playing by Internet Message Board Laws";
      const customSuffix = " | Site"; // 7 chars
      const result = truncateTitle(title, customSuffix);
      // Max title length = 70 - 7 = 63 chars
      // Title is 53 chars, so no truncation needed
      expect(result).toBe(title);
    });

    it('truncates with custom suffix when needed', () => {
      const title = "This is a very long title that will definitely need to be truncated for SEO";
      const customSuffix = " | Site"; // 7 chars, max title = 63 chars
      const result = truncateTitle(title, customSuffix);
      expect(result.endsWith('...')).toBe(true);
      expect(result.length + customSuffix.length).toBeLessThanOrEqual(70);
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
      expect(result.length + localThis.defaultSuffix.length).toBeLessThanOrEqual(70);
    });

    it('preserves apostrophes and special characters', () => {
      const title = "Murphy's Laws";
      const result = truncateTitle(title);
      expect(result).toContain("'");
    });
  });
});
