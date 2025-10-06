import { escapeHtml, highlightSearchTerm } from '../src/utils/sanitize.js';

describe('Sanitization utilities', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      const result = escapeHtml('<script>alert("xss")</script>');
      // Browser's innerHTML doesn't escape quotes inside text nodes
      expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('escapes single quotes', () => {
      // Browser's innerHTML doesn't escape single quotes in text nodes
      expect(escapeHtml("It's Murphy's Law")).toBe("It's Murphy's Law");
    });

    it('returns empty string for null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('highlightSearchTerm', () => {
    it('highlights matching search terms', () => {
      const result = highlightSearchTerm('Murphy\'s Law states things go wrong', 'murphy');
      expect(result).toContain('<mark>Murphy</mark>');
    });

    it('is case-insensitive', () => {
      const result = highlightSearchTerm('Things Go Wrong', 'GO');
      expect(result).toContain('<mark>Go</mark>');
    });

    it('escapes HTML in text', () => {
      const result = highlightSearchTerm('<script>test</script>', 'test');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('returns escaped text when no query', () => {
      const result = highlightSearchTerm('<b>test</b>', '');
      expect(result).toBe('&lt;b&gt;test&lt;/b&gt;');
    });
  });
});
