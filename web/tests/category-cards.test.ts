import { describe, it, expect } from 'vitest';
import { renderCategoryCard, renderCategoryClusters } from '../src/utils/category-cards.ts';

function toElement(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild!;
}

describe('renderCategoryCard', () => {
  it('links the whole card to the category with the title, description and count inside it', () => {
    const card = toElement(renderCategoryCard({ slug: 'murphys-office-laws', title: "Murphy's Office Laws", description: 'Cubicle wisdom.', law_count: 38 }));

    expect(card.tagName).toBe('A');
    expect(card.getAttribute('href')).toBe('/category/murphys-office-laws');
    expect(card.getAttribute('data-category-slug')).toBe('murphys-office-laws');
    expect(card.getAttribute('aria-label')).toBe("Murphy's Office Laws - 38 laws");
    expect(card.classList.contains('card--category')).toBe(true);
    expect(card.classList.contains('category-card--rich')).toBe(true);
    expect(card.querySelector('h3.category-card-title')?.textContent).toBe("Murphy's Office Laws");
    expect(card.querySelector('p.category-card-description')?.textContent).toBe('Cubicle wisdom.');
    expect(card.querySelector('.category-card-count')?.textContent).toBe('38 laws');
    expect(card.querySelector('.category-card-arrow')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses the singular for one law and zero when the count is missing', () => {
    const one = toElement(renderCategoryCard({ slug: 'a', title: 'A', law_count: 1 }));
    const none = toElement(renderCategoryCard({ slug: 'b', title: 'B' }));

    expect(one.querySelector('.category-card-count')?.textContent).toBe('1 law');
    expect(one.getAttribute('aria-label')).toBe('A - 1 law');
    expect(none.querySelector('.category-card-count')?.textContent).toBe('0 laws');
  });

  it('falls back to a generic description when the description is missing or blank', () => {
    const missing = toElement(renderCategoryCard({ slug: 'a', title: 'A', law_count: 2 }));
    const blank = toElement(renderCategoryCard({ slug: 'b', title: 'B', description: '   ', law_count: 2 }));

    expect(missing.querySelector('.category-card-description')?.textContent).toBe('Explore laws in this category.');
    expect(blank.querySelector('.category-card-description')?.textContent).toBe('Explore laws in this category.');
  });

  it('strips Markdown footnote markers and applies the display-name override', () => {
    const footnote = toElement(renderCategoryCard({ slug: 'murphys-cowboy', title: 'Cowboy Laws[^1]', description: 'Guns jam.[^2]', law_count: 3 }));
    const override = toElement(renderCategoryCard({ slug: 'murphys-4x4-car-laws', title: "Murphy's 4X4 Car Laws Section", law_count: 20 }));

    expect(footnote.querySelector('.category-card-title')?.textContent).toBe('Cowboy Laws');
    expect(footnote.querySelector('.category-card-description')?.textContent).toBe('Guns jam.');
    expect(override.querySelector('.category-card-title')?.textContent).toBe("Murphy's 4x4 & Off-Road Laws");
  });

  it('keeps the whole description, since CSS clamps it to three lines', () => {
    const description = 'word '.repeat(80).trim();
    const card = toElement(renderCategoryCard({ slug: 'a', title: 'A', description, law_count: 2 }));

    expect(card.querySelector('.category-card-description')?.textContent).toBe(description);
  });

  it('escapes the text and the slug and keeps the three parts of the card', () => {
    const card = toElement(renderCategoryCard({ slug: 'a"><script>', title: '<img src=x>', description: '<b>bold</b>', law_count: 2 }));

    expect(card.getAttribute('href')).toBe('/category/a"><script>');
    expect(card.querySelector('.category-card-title')?.textContent).toBe('<img src=x>');
    expect(card.querySelector('.category-card-description')?.textContent).toBe('<b>bold</b>');
    expect(card.children).toHaveLength(3);
    expect(card.querySelector('script, img, b')).toBeNull();
  });

  it('falls back when the description is only a footnote marker', () => {
    const card = toElement(renderCategoryCard({ slug: 'a', title: 'A', description: '[^1]', law_count: 2 }));
    expect(card.querySelector('.category-card-description')?.textContent).toBe('Explore laws in this category.');
  });
});

describe('renderCategoryClusters', () => {
  const host = document.createElement('div');
  host.innerHTML = renderCategoryClusters([
    { slug: 'murphys-love-laws', title: "Murphy's Love Laws", law_count: 225 },
    { slug: 'murphys-computer-laws', title: "Murphy's Computer Laws", law_count: 182 },
    { slug: 'murphys-something-else', title: 'Unmatched', law_count: 1 }
  ]);

  it('makes one labelled section per group, each with its own grid of cards', () => {
    const clusters = [...host.querySelectorAll('.category-cluster')];

    expect(clusters.map((cluster) => cluster.getAttribute('data-category-cluster'))).toEqual(['Technology', 'Relationships', 'Specialized']);
    clusters.forEach((cluster) => {
      const heading = cluster.querySelector('h2.category-cluster-title')!;
      expect(cluster.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(cluster.querySelectorAll(':scope > .categories-grid > a.category-card')).toHaveLength(1);
    });
  });

  it('gives the cluster headings distinct ids built from the group name', () => {
    const ids = [...host.querySelectorAll('.category-cluster-title')].map((heading) => heading.id);
    expect(ids).toEqual(['category-cluster-technology', 'category-cluster-relationships', 'category-cluster-specialized']);
  });

  it('returns nothing for no categories', () => {
    expect(renderCategoryClusters([]).trim()).toBe('');
  });
});
