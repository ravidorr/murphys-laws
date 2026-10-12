import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleFeaturedLaws, addArticleArchiveBlock } from '../src/components/article-featured-laws.ts';
import { getArticleArchiveLinks } from '../src/utils/internal-links.ts';
import { trackProductEvent } from '../src/utils/metrics.ts';
import * as api from '../src/utils/api.ts';
import type { Law } from '../src/types/app.d.ts';

vi.mock('../src/utils/metrics.ts', () => ({
  trackProductEvent: vi.fn()
}));

const laws: Law[] = [
  { id: 1, title: 'Murphy', text: 'If anything can go wrong, it will.', upvotes: 9, downvotes: 1, category_slug: 'murphys-laws', category_name: "Murphy's Laws" },
  { id: 2, text: 'Nothing is as easy as it looks.', upvotes: 5, downvotes: 0 },
  { id: 3, text: 'Everything takes longer than you think.', upvotes: 4, downvotes: 0 },
  { id: 4, text: 'A fourth law that should not be shown.', upvotes: 1, downvotes: 0 }
];

const ARTICLE_HTML = `
  <h1 class="page-title mb-4">The True Origin</h1>
  <article class="card card--content content-card">
    <header class="card-header content-header"><p class="lead">Lead</p></header>
    <div class="card-body"><p><a href="/category/murphys-technology-laws">technology laws</a></p></div>
  </article>`;

function renderArticle(page: Parameters<typeof addArticleArchiveBlock>[1], onNavigate?: (page: string, param?: string) => void): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = ARTICLE_HTML;
  addArticleArchiveBlock(el, page, onNavigate);
  document.body.appendChild(el);
  return el;
}

describe('ArticleFeaturedLaws component', () => {
  const localThis: { fetchLaws: ReturnType<typeof vi.spyOn> | null } = { fetchLaws: null };

  beforeEach(() => {
    localStorage.clear();
    localThis.fetchLaws = vi.spyOn(api, 'fetchLaws').mockResolvedValue({ data: laws, total: 4, limit: 3, offset: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders three top-scoring laws from the featured category with archive buttons', async () => {
    const el = ArticleFeaturedLaws(getArticleArchiveLinks('origin-story')!);

    expect(localThis.fetchLaws).toHaveBeenCalledWith({ category_slug: 'murphys-laws', limit: 3, sort: 'score', order: 'desc' });
    expect(el.classList.contains('article-featured-laws')).toBe(true);
    expect(el.querySelector('.card-title')?.textContent).toBe('Laws behind this story');

    await vi.waitFor(() => {
      expect(el.querySelectorAll('.law-card-mini')).toHaveLength(3);
    });
    expect(el.hidden).toBe(false);
    expect(el.textContent).not.toContain('A fourth law');
    expect(el.querySelector('a.law-card-link')?.getAttribute('data-param')).toBe('1');
    expect(el.querySelector('button[data-vote="up"]')).not.toBeNull();

    const actions = el.querySelectorAll<HTMLAnchorElement>('.card-footer a.article-cta');
    expect(Array.from(actions, (action) => action.getAttribute('href'))).toEqual(['/category/murphys-laws', '/submit']);
    expect(actions[0]!.textContent).toBe("See all Murphy's Laws");
    expect(actions[1]!.getAttribute('data-nav')).toBe('submit');
  });

  it('hides itself when the category has no laws', async () => {
    localThis.fetchLaws!.mockResolvedValue({ data: [], total: 0, limit: 3, offset: 0 });
    const el = ArticleFeaturedLaws(getArticleArchiveLinks('examples/travel')!);

    expect(localThis.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({ category_slug: 'murphys-travel-laws' }));
    await vi.waitFor(() => {
      expect(el.hidden).toBe(true);
    });
  });

  it('hides itself when the response has no law list', async () => {
    localThis.fetchLaws!.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof api.fetchLaws>>);
    const missing = ArticleFeaturedLaws(getArticleArchiveLinks('origin-story')!);
    localThis.fetchLaws!.mockResolvedValue({ data: 'oops' } as unknown as Awaited<ReturnType<typeof api.fetchLaws>>);
    const malformed = ArticleFeaturedLaws(getArticleArchiveLinks('origin-story')!);

    await vi.waitFor(() => {
      expect(missing.hidden).toBe(true);
      expect(malformed.hidden).toBe(true);
    });
  });

  it('hides itself when the request fails', async () => {
    localThis.fetchLaws!.mockRejectedValue(new Error('network down'));
    const el = ArticleFeaturedLaws(getArticleArchiveLinks('origin-story')!);

    await vi.waitFor(() => {
      expect(el.hidden).toBe(true);
    });
  });
});

describe('addArticleArchiveBlock', () => {
  type PendoTrack = (eventName: string, properties?: Record<string, unknown>) => void;
  const localThis: { track: ReturnType<typeof vi.fn<PendoTrack>> | null; el: HTMLDivElement | null } = { track: null, el: null };

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(trackProductEvent).mockClear();
    vi.spyOn(api, 'fetchLaws').mockResolvedValue({ data: laws, total: 4, limit: 3, offset: 0 });
    localThis.track = vi.fn<PendoTrack>();
    window.pendo = { track: localThis.track };
  });

  afterEach(() => {
    localThis.el?.remove();
    localThis.el = null;
    delete window.pendo;
    vi.restoreAllMocks();
  });

  it('adds the button row under the title and featured laws after the article card', () => {
    localThis.el = renderArticle('origin-story');

    const row = localThis.el.querySelector('h1.page-title')!.nextElementSibling!;
    expect(row.matches('nav.article-next-steps')).toBe(true);
    expect(row.getAttribute('aria-label')).toBe('Explore the archive');
    expect(row.querySelector('a.btn.primary')?.getAttribute('href')).toBe('/category/murphys-laws');
    expect(localThis.el.querySelector('article.content-card')!.nextElementSibling!.classList.contains('article-featured-laws')).toBe(true);
    // The row sits outside the article card, so in-prose category link counts are unchanged
    expect(localThis.el.querySelectorAll('.content-card a[href*="/category/"]')).toHaveLength(1);
  });

  it('leaves pages without an archive mapping unchanged', () => {
    localThis.el = renderArticle('about');

    expect(localThis.el.querySelector('.article-next-steps')).toBeNull();
    expect(localThis.el.querySelector('.article-featured-laws')).toBeNull();
    expect(api.fetchLaws).not.toHaveBeenCalled();
  });

  it('skips the parts whose anchors are missing from the article markup', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>No title or article card</p>';

    addArticleArchiveBlock(el, 'examples');

    expect(el.querySelector('.article-next-steps')).toBeNull();
    expect(el.querySelector('.article-featured-laws')).toBeNull();
  });

  it('reports archive button clicks with their target and position', () => {
    localThis.el = renderArticle('origin-story');
    const buttons = localThis.el.querySelectorAll<HTMLAnchorElement>('.article-next-steps a');

    buttons[0]!.addEventListener('click', (e) => e.preventDefault());
    buttons[0]!.click();
    buttons[2]!.addEventListener('click', (e) => e.preventDefault());
    buttons[2]!.click();

    expect(localThis.track).toHaveBeenCalledWith('article_cta_clicked', {
      article: 'origin-story',
      target: '/category/murphys-laws',
      position: 'next_steps'
    });
    expect(localThis.track).toHaveBeenCalledWith('article_cta_clicked', {
      article: 'origin-story',
      target: '/browse',
      position: 'next_steps'
    });
    expect(trackProductEvent).toHaveBeenCalledTimes(1);
    expect(trackProductEvent).toHaveBeenCalledWith('category.click', { surface: 'article', category: 'murphys-laws' });
  });

  it('reports featured law and footer clicks as featured_laws', async () => {
    localThis.el = renderArticle('examples');
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.article-featured-laws a.law-card-link')).not.toBeNull();
    });

    const lawLink = localThis.el.querySelector<HTMLAnchorElement>('.article-featured-laws a.law-card-link')!;
    lawLink.addEventListener('click', (e) => e.preventDefault());
    lawLink.click();
    const submit = localThis.el.querySelector<HTMLAnchorElement>('.article-featured-laws a.article-cta--submit')!;
    submit.addEventListener('click', (e) => e.preventDefault());
    submit.click();

    expect(localThis.track).toHaveBeenCalledWith('article_cta_clicked', { article: 'examples', target: '/law/1', position: 'featured_laws' });
    expect(localThis.track).toHaveBeenCalledWith('article_cta_clicked', { article: 'examples', target: '/submit', position: 'featured_laws' });
  });

  it('opens a featured law when its card is clicked outside links and buttons', async () => {
    const onNavigate = vi.fn();
    localThis.el = renderArticle('murphys-law-vs-sods-law', onNavigate);
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.article-featured-laws .law-card-mini')).not.toBeNull();
    });
    const card = localThis.el.querySelector<HTMLElement>('.article-featured-laws .law-card-mini')!;

    const button = document.createElement('button');
    button.type = 'button';
    card.appendChild(button);
    button.click();
    expect(onNavigate).not.toHaveBeenCalled();

    card.querySelector<HTMLElement>('.law-card-text')!.click();
    expect(onNavigate).toHaveBeenCalledWith('law', '1');
    expect(localThis.track).toHaveBeenCalledWith('article_cta_clicked', {
      article: 'murphys-law-vs-sods-law',
      target: '/law/1',
      position: 'featured_laws'
    });
  });

  it('ignores card clicks without a navigation callback, outside cards, and from non-element targets', async () => {
    localThis.el = renderArticle('origin-story');
    await vi.waitFor(() => {
      expect(localThis.el!.querySelector('.article-featured-laws .law-card-mini')).not.toBeNull();
    });

    localThis.el.querySelector<HTMLElement>('.article-featured-laws .law-card-text')!.click();
    localThis.el.querySelector<HTMLElement>('.lead')!.click();
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    localThis.el.dispatchEvent(event);

    expect(localThis.track).not.toHaveBeenCalled();
  });
});
