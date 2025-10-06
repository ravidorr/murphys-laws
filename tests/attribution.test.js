import { firstAttributionLine } from '../src/utils/attribution.js';

describe('Attribution utilities', () => {
  describe('firstAttributionLine', () => {
    it('returns empty string for no attributions', () => {
      const law = { attributions: [] };
      expect(firstAttributionLine(law)).toBe('');
    });

    it('formats name only attribution', () => {
      const law = {
        attributions: [{ name: 'John Doe', contact_type: null, contact_value: null }]
      };
      expect(firstAttributionLine(law)).toBe('Sent by John Doe');
    });

    it('formats name with email', () => {
      const law = {
        attributions: [{ name: 'John Doe', contact_type: 'email', contact_value: 'john@example.com' }]
      };
      const result = firstAttributionLine(law);
      expect(result).toContain('Sent by');
      expect(result).toContain('John Doe');
      expect(result).toContain('mailto:john@example.com');
    });

    it('formats name with URL', () => {
      const law = {
        attributions: [{ name: 'John Doe', contact_type: 'url', contact_value: 'https://example.com' }]
      };
      const result = firstAttributionLine(law);
      expect(result).toContain('John Doe');
      expect(result).toContain('<a href="https://example.com"');
    });

    it('escapes HTML in name', () => {
      const law = {
        attributions: [{ name: '<script>alert("xss")</script>', contact_type: null }]
      };
      const result = firstAttributionLine(law);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('only returns first attribution when multiple exist', () => {
      const law = {
        attributions: [
          { name: 'First Author', contact_type: null },
          { name: 'Second Author', contact_type: null }
        ]
      };
      expect(firstAttributionLine(law)).toBe('Sent by First Author');
    });

    it('handles missing attributions array', () => {
      const law = {};
      expect(firstAttributionLine(law)).toBe('');
    });
  });
});
