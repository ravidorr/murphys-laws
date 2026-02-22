import { describe, it, expect } from 'vitest';
import { getContextForCategory } from '../src/utils/law-context-copy.js';

describe('law-context-copy', () => {
  describe('getContextForCategory', () => {
    it('returns default context for undefined', () => {
      const text = getContextForCategory(undefined);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(50);
      expect(text).toContain("Murphy's");
    });

    it('returns default context for null', () => {
      const text = getContextForCategory(null);
      expect(text).toBeTruthy();
      expect(text).toContain("Murphy's");
    });

    it('returns default context for empty string', () => {
      const text = getContextForCategory('');
      expect(text).toBeTruthy();
    });

    it('returns category-specific context for known slug', () => {
      const text = getContextForCategory('murphys-computers-laws');
      expect(text).toBeTruthy();
      expect(text).toContain('Computer');
      expect(text).not.toBe(getContextForCategory(undefined));
    });

    it('returns category-specific context for murphys-laws slug', () => {
      const text = getContextForCategory('murphys-laws');
      expect(text).toBeTruthy();
      expect(text).toContain('universal');
    });

    it('is case-insensitive for slug lookup', () => {
      const lower = getContextForCategory('murphys-office-laws');
      const upper = getContextForCategory('MURPHYS-OFFICE-LAWS');
      expect(lower).toBe(upper);
    });

    it('returns default context for unknown slug', () => {
      const text = getContextForCategory('unknown-category-slug');
      expect(text).toBeTruthy();
      expect(text).toContain("Murphy's");
    });
  });
});
