import { describe, expect, it } from 'vitest';
import {
  getArticleArchiveLinks,
  getCalculatorScenarioLinks,
  getCategoryHubLinks,
  getHubLinks,
  getLawDetailInternalLinks,
  renderArticleFeaturedLawsActions,
  renderArticleNextSteps,
  renderInternalLinkList
} from '../src/utils/internal-links.ts';
import type { ContentPage } from '../src/utils/markdown-content.ts';

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

  it('maps the landing articles to their archive categories', () => {
    const originStory = getArticleArchiveLinks('origin-story')!;
    expect(originStory.featuredCategory.slug).toBe('murphys-laws');
    expect(originStory.links.map((link) => link.href)).toEqual([
      '/category/murphys-laws',
      '/category/murphys-technology-laws',
      '/browse'
    ]);
    expect(originStory.links[0]!.label).toBe("Read the original Murphy's Laws");

    expect(getArticleArchiveLinks('examples')!.links.map((link) => link.href)).toEqual([
      '/category/murphys-technology-laws',
      '/category/murphys-office-laws',
      '/category/murphys-travel-laws',
      '/categories'
    ]);
    expect(getArticleArchiveLinks('murphys-law-vs-sods-law')!.links.map((link) => link.href)).toEqual([
      '/category/murphys-laws',
      '/category/murphys-office-laws',
      '/browse'
    ]);
  });

  it('maps the remaining articles to themed categories and leaves other pages unmapped', () => {
    const featured = (page: ContentPage) => getArticleArchiveLinks(page)?.featuredCategory.slug;

    expect(featured('why-murphys-law-feels-true')).toBe('murphys-office-laws');
    expect(featured('murphys-law-project-management')).toBe('murphys-office-laws');
    expect(featured('murphys-laws-about-work')).toBe('murphys-office-laws');
    expect(featured('examples/work')).toBe('murphys-office-laws');
    expect(featured('examples/travel')).toBe('murphys-travel-laws');
    expect(featured('examples/tech')).toBe('murphys-technology-laws');
    expect(featured('examples/everyday-life')).toBe('murphys-laws');
    expect(getArticleArchiveLinks('about')).toBeNull();
    expect(getArticleArchiveLinks('best-murphys-laws')).toBeNull();
  });

  it('only sends article readers into the archive with canonical category slugs', () => {
    const pages: ContentPage[] = [
      'origin-story', 'examples', 'murphys-law-vs-sods-law', 'why-murphys-law-feels-true',
      'murphys-law-project-management', 'murphys-laws-about-work',
      'examples/work', 'examples/travel', 'examples/tech', 'examples/everyday-life'
    ];

    for (const page of pages) {
      const archive = getArticleArchiveLinks(page)!;
      expect(archive.links.length).toBeGreaterThan(0);
      for (const { href } of archive.links) {
        expect(href).toMatch(/^\/(category\/murphys-[a-z-]+|browse|categories)$/);
        expect(href).not.toBe('/category/murphys-computers-laws');
      }
    }
  });

  it('renders the article button row with one primary category button', () => {
    expect(renderArticleNextSteps(null)).toBe('');

    const container = document.createElement('div');
    container.innerHTML = renderArticleNextSteps(getArticleArchiveLinks('origin-story'));
    const nav = container.querySelector('nav.section.card.card--section.section-card.article-next-steps')!;
    expect(nav.getAttribute('aria-label')).toBe('Explore the archive');

    const buttons = nav.querySelectorAll('.not-found-actions a');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.className).toBe('btn primary article-cta article-cta--category');
    expect(buttons[0]!.getAttribute('data-nav')).toBe('category/murphys-laws');
    expect(buttons[1]!.className).toBe('btn outline article-cta article-cta--category');
    expect(buttons[2]!.className).toBe('btn outline article-cta article-cta--browse');
    expect(buttons[2]!.getAttribute('data-nav')).toBe('browse');
  });

  it('renders featured-law actions for the whole category and submissions', () => {
    const container = document.createElement('div');
    container.innerHTML = renderArticleFeaturedLawsActions({ slug: 'murphys-office-laws', name: "Murphy's Office Laws" });
    const [category, submit] = Array.from(container.querySelectorAll('a'));

    expect(category!.textContent).toBe("See all Murphy's Office Laws");
    expect(category!.getAttribute('href')).toBe('/category/murphys-office-laws');
    expect(category!.className).toBe('btn primary article-cta article-cta--category');
    expect(submit!.textContent).toBe('Submit your own');
    expect(submit!.getAttribute('data-nav')).toBe('submit');
    expect(submit!.className).toBe('btn outline article-cta article-cta--submit');
  });
});
