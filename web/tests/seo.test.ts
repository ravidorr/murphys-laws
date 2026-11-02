import {
  buildBreadcrumbList,
  buildCanonicalUrl,
  buildLawSeo,
  buildUniqueLawSeo,
  cutAtWord,
  isGenericLawTitle,
  truncateTitle
} from '../src/utils/seo.ts';

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

  describe('buildCanonicalUrl', () => {
    it('normalizes paths against the canonical apex host', () => {
      expect(buildCanonicalUrl('/law/123')).toBe('https://murphys-laws.com/law/123');
      expect(buildCanonicalUrl('categories')).toBe('https://murphys-laws.com/categories');
    });

    it('removes www host variants and query strings from canonical URLs', () => {
      expect(buildCanonicalUrl('https://www.murphys-laws.com/browse?q=toast')).toBe('https://murphys-laws.com/browse');
    });

    it('keeps root canonical URL slash', () => {
      expect(buildCanonicalUrl('/')).toBe('https://murphys-laws.com/');
    });
  });
});

describe('law SEO helpers', () => {
  describe('cutAtWord', () => {
    it('returns short text with collapsed whitespace', () => {
      expect(cutAtWord('  a   b  ', 20)).toBe('a b');
    });

    it('cuts at a word boundary and adds an ellipsis', () => {
      const result = cutAtWord('The quick brown fox jumps over the lazy dog again', 30);
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result.endsWith('...')).toBe(true);
      expect(result).toBe('The quick brown fox jumps...');
    });

    it('cuts mid-word when no usable space exists', () => {
      expect(cutAtWord('Supercalifragilisticexpialidocious', 12)).toBe('Supercali...');
    });
  });

  describe('isGenericLawTitle', () => {
    it.each([undefined, null, '', '  ', "Murphy's Law", 'corollary', 'LAW'])('treats %j as generic', (title) => {
      expect(isGenericLawTitle(title as string | null | undefined)).toBe(true);
    });

    it('keeps meaningful titles', () => {
      expect(isGenericLawTitle("Hofstadter's Law")).toBe(false);
    });
  });

  describe('buildLawSeo', () => {
    it('keeps a meaningful law title', () => {
      const seo = buildLawSeo({ id: 1, title: "Hofstadter's Law", text: 'It always takes longer than you expect, even when you take into account Hofstadter\'s Law.' });
      expect(seo.title).toBe("Hofstadter's Law - Murphy's Law Archive");
      expect(seo.headline).toBe("Hofstadter's Law");
    });

    it('derives the title from the text for generic titles', () => {
      const seo = buildLawSeo({ id: 2, title: "Murphy's Law", text: "Night vision - isn't." });
      expect(seo.title).toBe("Night vision - isn't - Murphy's Law Archive");
      expect(seo.headline).toBe("Night vision - isn't");
    });

    it('keeps derived titles within 60 characters', () => {
      const seo = buildLawSeo({ id: 3, title: 'Corollary', text: 'Every instructor assumes that you have nothing else to do except study for that course.' });
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.title.endsWith("... - Murphy's Law Archive")).toBe(true);
    });

    it('falls back to the id when title and text are both empty', () => {
      const seo = buildLawSeo({ id: 4, title: '', text: '' });
      expect(seo.title).toBe("Murphy's Law #4 - Murphy's Law Archive");
      expect(seo.description).toBe("A Murphy's Law from the Murphy's Law Archive.");
    });

    it('pads short descriptions with the category', () => {
      const seo = buildLawSeo({ id: 5, text: 'Anything that can go wrong will', category_name: 'General' });
      expect(seo.description).toBe("Anything that can go wrong will. A Murphy's Law from the General category.");
    });

    it('drops a trailing colon from derived titles and padded descriptions', () => {
      const seo = buildLawSeo({ id: 10, title: 'Law', text: "Lackland's Laws:", category_name: 'War' });
      expect(seo.title).toBe("Lackland's Laws - Murphy's Law Archive");
      expect(seo.description).toBe("Lackland's Laws. A Murphy's Law from the War category.");
    });

    it('does not double a final period when padding', () => {
      const seo = buildLawSeo({ id: 5, text: 'Anything that can go wrong will go wrong.' });
      expect(seo.description).toBe("Anything that can go wrong will go wrong. From the Murphy's Law Archive.");
    });

    it('uses the generic context when the category makes the description too long', () => {
      const category = 'An Extremely Long Category Name '.repeat(3).trim();
      const text = 'Short law text that is long enough to be near the minimum but below it for sure here';
      const seo = buildLawSeo({ id: 6, text, category_name: category });
      expect(seo.description.length).toBeLessThanOrEqual(160);
      expect(seo.description.endsWith("From the Murphy's Law Archive.")).toBe(true);
    });

    it('leaves mid-length descriptions untouched', () => {
      const text = 'A'.repeat(120);
      expect(buildLawSeo({ id: 7, text }).description).toBe(text);
    });

    it('truncates long descriptions at a word boundary', () => {
      const text = 'word '.repeat(60);
      const { description } = buildLawSeo({ id: 8, text });
      expect(description.length).toBeLessThanOrEqual(155);
      expect(description.endsWith('...')).toBe(true);
    });

    it('can disambiguate title and description with the law id', () => {
      const seo = buildLawSeo(
        { id: 9, title: 'Corollary', text: 'Same text for two laws that is quite long enough to avoid any padding at all, honestly.' },
        { disambiguateTitle: true, disambiguateDescription: true }
      );
      expect(seo.title).toBe("Same text for two laws that is... #9 - Murphy's Law Archive");
      expect(seo.description.endsWith('(Law #9)')).toBe(true);
      expect(seo.description.length).toBeLessThanOrEqual(160);
    });
  });

  describe('buildUniqueLawSeo', () => {
    it('keeps unique laws unchanged and disambiguates collisions', () => {
      const laws = [
        { id: 1, title: 'Law', text: 'Identical text that is long enough to need no padding whatsoever in this fixture, really yes.' },
        { id: 2, title: 'Corollary', text: 'Identical text that is long enough to need no padding whatsoever in this fixture, really yes.' },
        { id: 3, title: "Hofstadter's Law", text: 'It always takes longer than you expect, even when you take into account Hofstadter\'s Law.' }
      ];
      const result = buildUniqueLawSeo(laws);
      expect(result.get('3')?.title).toBe("Hofstadter's Law - Murphy's Law Archive");
      expect(result.get('1')?.title).not.toBe(result.get('2')?.title);
      expect(result.get('1')?.description).not.toBe(result.get('2')?.description);
      expect(new Set([...result.values()].map((seo) => seo.title)).size).toBe(3);
    });
  });
});

describe('buildBreadcrumbList', () => {
  it('numbers items and resolves paths against the site url', () => {
    const list = buildBreadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Categories', path: '/categories' }
    ]) as { itemListElement: Array<{ position: number; item: string }> };
    expect(list.itemListElement).toEqual([
      expect.objectContaining({ position: 1, item: 'https://murphys-laws.com' }),
      expect.objectContaining({ position: 2, item: 'https://murphys-laws.com/categories' })
    ]);
  });
});
