import { firstAttributionLine, renderAttribution, renderAttributionsList } from '../src/utils/attribution.js';

describe('Attribution utilities', () => {
  describe('renderAttribution', () => {
    it('returns empty string for null attribution', () => {
      expect(renderAttribution(null)).toBe('');
    });

    it('returns name without contact info', () => {
      expect(renderAttribution({ name: 'John' })).toBe('John');
    });

    it('renders email link', () => {
      const att = { name: 'John', contact_type: 'email', contact_value: 'john@example.com' };
      const result = renderAttribution(att);
      expect(result).toContain('mailto:john@example.com');
      expect(result).toContain('John');
    });

    it('renders URL link', () => {
      const att = { name: 'John', contact_type: 'url', contact_value: 'https://example.com' };
      const result = renderAttribution(att);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('John');
    });

    it('falls back to name only for invalid URL', () => {
      const att = { name: 'John', contact_type: 'url', contact_value: 'javascript:alert(1)' };
      const result = renderAttribution(att);
      expect(result).toBe('John');
      expect(result).not.toContain('href');
    });

    it('includes note when provided', () => {
      const att = { name: 'John', note: 'Great person' };
      expect(renderAttribution(att)).toBe('John — Great person');
    });

    it('handles attribution without note', () => {
      const att = { name: 'John' };
      expect(renderAttribution(att)).toBe('John');
    });

    it('handles attribution without name', () => {
      const att = { note: 'Anonymous contribution' };
      expect(renderAttribution(att)).toBe(' — Anonymous contribution');
    });
  });

  describe('renderAttributionsList', () => {
    it('returns empty string for empty array', () => {
      expect(renderAttributionsList([])).toBe('');
    });

    it('returns empty string for null', () => {
      expect(renderAttributionsList(null)).toBe('');
    });

    it('returns empty string for array of null attributions', () => {
      expect(renderAttributionsList([null, null])).toBe('');
    });

    it('renders single attribution', () => {
      const atts = [{ name: 'John' }];
      const result = renderAttributionsList(atts);
      expect(result).toContain('Sent by John');
      expect(result).toContain('<p class="small mb-4">');
    });

    it('renders multiple attributions separated by commas', () => {
      const atts = [{ name: 'John' }, { name: 'Jane' }];
      const result = renderAttributionsList(atts);
      expect(result).toContain('John, Jane');
    });
  });

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

    it('falls back to author when no attributions', () => {
      const law = { attributions: [], author: 'Murphy' };
      expect(firstAttributionLine(law)).toBe('— Murphy');
    });

    it('falls back to author when attributions is missing', () => {
      const law = { author: 'Murphy' };
      expect(firstAttributionLine(law)).toBe('— Murphy');
    });
  });
});
