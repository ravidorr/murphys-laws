import { describe, it, expect } from 'vitest';
import { getDefaultLawContext } from '../src/utils/law-context-copy.js';

describe('law-context-copy', () => {
  describe('getDefaultLawContext', () => {
    it('returns a non-empty string', () => {
      const text = getDefaultLawContext();
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(50);
    });

    it('returns copy that mentions Murphy', () => {
      const text = getDefaultLawContext();
      expect(text).toContain("Murphy's");
    });

    it('returns the same value on every call', () => {
      expect(getDefaultLawContext()).toBe(getDefaultLawContext());
    });
  });
});
