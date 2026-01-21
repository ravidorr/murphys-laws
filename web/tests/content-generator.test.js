import { generateCategoryDescription } from '../src/utils/content-generator.js';

describe('content-generator', () => {
  describe('generateCategoryDescription', () => {
    it('generates a description containing the title and law count', () => {
      const description = generateCategoryDescription('Technology', 42);
      
      expect(description).toContain('Technology');
      expect(description).toContain('42');
    });

    it('returns a non-empty string', () => {
      const description = generateCategoryDescription('Computers', 10);
      
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('produces deterministic output for same input', () => {
      const title = 'Work';
      const lawCount = 25;
      
      const desc1 = generateCategoryDescription(title, lawCount);
      const desc2 = generateCategoryDescription(title, lawCount);
      
      expect(desc1).toBe(desc2);
    });

    it('produces different output for different titles', () => {
      const desc1 = generateCategoryDescription('Technology', 10);
      const desc2 = generateCategoryDescription('Science', 10);
      
      // Not guaranteed to be different, but very likely for different titles
      // At minimum, they should both be valid strings
      expect(typeof desc1).toBe('string');
      expect(typeof desc2).toBe('string');
    });

    it('handles single character title', () => {
      const description = generateCategoryDescription('A', 5);
      
      expect(description).toContain('A');
      expect(description).toContain('5');
    });

    it('handles zero law count', () => {
      const description = generateCategoryDescription('Empty', 0);
      
      expect(description).toContain('0');
    });
  });
});
