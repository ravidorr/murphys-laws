import { describe, it, expect } from 'vitest';
import type { Attribution } from '../src/types/app.d.ts';
import { firstAttributionLine, renderAttribution, renderAttributionsList, isEmailLikeDisplay, submittedByLabel } from '../src/utils/attribution.ts';

describe('Attribution utilities', () => {
  describe('renderAttribution', () => {
    it('returns empty string for null attribution', () => {
      expect(renderAttribution(null)).toBe('');
    });

    it('returns name without contact info', () => {
      expect(renderAttribution({ name: 'John' })).toBe('John');
    });

    it('renders name only for attribution with email (privacy: no mailto)', () => {
      const att: Attribution = { name: 'John', contact_type: 'email', contact_value: 'john@example.com' };
      const result = renderAttribution(att);
      expect(result).toBe('John');
      expect(result).not.toContain('mailto:');
    });

    it('renders name only for attribution with URL (privacy: no link)', () => {
      const att: Attribution = { name: 'John', contact_type: 'url', contact_value: 'https://example.com' };
      const result = renderAttribution(att);
      expect(result).toBe('John');
      expect(result).not.toContain('href=');
    });

    it('includes note when provided', () => {
      const att = { name: 'John', note: 'Great person' };
      expect(renderAttribution(att)).toBe('John - Great person');
    });

    it('handles attribution without note', () => {
      const att = { name: 'John' };
      expect(renderAttribution(att)).toBe('John');
    });

    it('handles attribution without name', () => {
      const att = { note: 'Anonymous contribution' };
      expect(renderAttribution(att)).toBe('Anonymous contribution');
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

    it('formats name only when attribution had email (no mailto)', () => {
      const law = {
        attributions: [{ name: 'John Doe', contact_type: 'email' as const, contact_value: 'john@example.com' }]
      };
      const result = firstAttributionLine(law);
      expect(result).toContain('Sent by');
      expect(result).toContain('John Doe');
      expect(result).not.toContain('mailto:');
    });

    it('formats name only when attribution had URL (no link)', () => {
      const law = {
        attributions: [{ name: 'John Doe', contact_type: 'url' as const, contact_value: 'https://example.com' }]
      };
      const result = firstAttributionLine(law);
      expect(result).toContain('John Doe');
      expect(result).not.toContain('<a href=');
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

    it('L33 B1: firstAttributionLine uses first attribution name when present', () => {
      const law = { attributions: [{ name: 'Valid Name' }] };
      expect(firstAttributionLine(law)).toBe('Sent by Valid Name');
    });

    it('returns Sent by when first attribution has no name but exists', () => {
      const law = { attributions: [{ name: null } as Attribution] };
      expect(firstAttributionLine(law)).toBe('Sent by ');
    });

    it('falls back to author when no attributions', () => {
      const law = { attributions: [], author: 'Murphy' };
      expect(firstAttributionLine(law)).toBe('- Murphy');
    });

    it('falls back to author when attributions is missing', () => {
      const law = { author: 'Murphy' };
      expect(firstAttributionLine(law)).toBe('- Murphy');
    });
  });

  describe('isEmailLikeDisplay', () => {
    it('returns true for email-like string', () => {
      expect(isEmailLikeDisplay('a@b.com')).toBe(true);
      expect(isEmailLikeDisplay('user@example.org')).toBe(true);
    });
    it('returns false for display name', () => {
      expect(isEmailLikeDisplay('Jane Doe')).toBe(false);
      expect(isEmailLikeDisplay('Murphy')).toBe(false);
    });
    it('L7 B0: returns true for non-string or empty/whitespace', () => {
      expect(isEmailLikeDisplay('')).toBe(true);
      expect(isEmailLikeDisplay('   ')).toBe(true);
      expect(isEmailLikeDisplay(null as unknown as string)).toBe(true);
      expect(isEmailLikeDisplay(undefined as unknown as string)).toBe(true);
    });
  });

  describe('submittedByLabel', () => {
    it('returns Anonymous for empty or email-like name', () => {
      expect(submittedByLabel([])).toBe('Anonymous');
      expect(submittedByLabel([{ name: 'a@b.com' }])).toBe('Anonymous');
    });
    it('returns trimmed name for display-safe attribution', () => {
      expect(submittedByLabel([{ name: '  Jane Doe  ' }])).toBe('Jane Doe');
    });
  });
});
