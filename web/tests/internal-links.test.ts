import { describe, expect, it } from 'vitest';
import {
  getCalculatorScenarioLinks,
  getCategoryHubLinks,
  getHubLinks,
  getLawDetailInternalLinks,
  renderInternalLinkList
} from '../src/utils/internal-links.ts';

describe('internal links', () => {
  it('builds law detail links from category context', () => {
    const links = getLawDetailInternalLinks({
      categorySlug: 'murphys-technology-laws',
      categoryName: "Murphy's Technology Laws"
    });

    expect(links.map((link) => link.href)).toEqual([
      '/category/murphys-technology-laws',
      '/murphys-laws-about-technology',
      '/examples/tech',
      '/calculator/sods-law'
    ]);
  });

  it('falls back to archive links when law category is missing', () => {
    expect(getLawDetailInternalLinks({}).map((link) => link.href)).toEqual([
      '/browse',
      '/categories',
      '/best-murphys-laws'
    ]);
  });

  it('uses a generic label when category name is missing', () => {
    const links = getLawDetailInternalLinks({ categorySlug: 'uncategorized' });

    expect(links[0]!.label).toBe('Same category');
  });

  it('builds category hub links with related category and hub destinations', () => {
    const links = getCategoryHubLinks('murphys-travel-laws');

    expect(links.map((link) => link.href)).toContain('/examples/travel');
    expect(links.map((link) => link.href)).toContain('/category/murphys-bus-laws');
    expect(links.map((link) => link.href)).toContain('/calculator/sods-law');
  });

  it('returns fallback category hub links for unknown categories', () => {
    expect(getCategoryHubLinks('unknown-category').map((link) => link.href)).toEqual([
      '/best-murphys-laws',
      '/categories'
    ]);
  });

  it('builds calculator scenario links', () => {
    expect(getCalculatorScenarioLinks('sods-law').map((link) => link.href)).toContain('/murphys-law-vs-sods-law');
    expect(getCalculatorScenarioLinks('buttered-toast').map((link) => link.href)).toContain('/examples/everyday-life');
  });

  it('provides global hub links', () => {
    expect(getHubLinks().map((link) => link.href)).toEqual([
      '/best-murphys-laws',
      '/funniest-murphys-laws',
      '/murphys-laws-about-work',
      '/murphys-laws-about-technology',
      '/murphys-law-vs-sods-law'
    ]);
  });

  it('renders accessible link-list markup', () => {
    const html = renderInternalLinkList([{ href: '/browse', label: 'Browse', description: 'All laws' }]);

    expect(html).toContain('<ul class="internal-link-list">');
    expect(html).toContain('href="/browse"');
    expect(html).toContain('All laws');
  });
});
