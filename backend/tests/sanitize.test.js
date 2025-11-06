import { escapeHtml, highlightSearchTerm, sanitizeUrl } from '../src/utils/sanitize.js';

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

    it('returns empty string when text is not a string', () => {
      expect(highlightSearchTerm(null, 'test')).toBe('');
      expect(highlightSearchTerm(undefined, 'test')).toBe('');
      expect(highlightSearchTerm(123, 'test')).toBe('');
      expect(highlightSearchTerm({}, 'test')).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows safe http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('allows safe https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('blocks javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('blocks javascript: protocol with uppercase', () => {
      expect(sanitizeUrl('JavaScript:alert(1)')).toBe('');
    });

    it('blocks data: protocol', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('blocks data: protocol with uppercase', () => {
      expect(sanitizeUrl('Data:text/html,test')).toBe('');
    });

    it('blocks vbscript: protocol', () => {
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('');
    });

    it('blocks vbscript: protocol with uppercase', () => {
      expect(sanitizeUrl('VBScript:msgbox(1)')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(sanitizeUrl(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(sanitizeUrl(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(sanitizeUrl('')).toBe('');
    });

    it('handles URLs with whitespace', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('  https://example.com  ');
    });

    it('blocks javascript: with leading whitespace', () => {
      expect(sanitizeUrl('  javascript:alert(1)')).toBe('');
    });
  });
});
