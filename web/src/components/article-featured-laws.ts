// Article archive block: a button row into the archive under an article's title,
// plus three vote-able laws from the article's featured category after the article.

import { fetchLaws } from '../utils/api.ts';
import { createLawListSection } from './law-list-section.ts';
import { WIDGET_CARD_COUNT } from '../utils/constants.ts';
import { addCopyActionListeners } from '../utils/copy-actions.ts';
import {
  getArticleArchiveLinks,
  renderArticleFeaturedLawsActions,
  renderArticleNextSteps,
  type ArticleArchiveLinks
} from '@utils/internal-links.ts';
import { trackPendoEvent } from '@utils/pendo.ts';
import { trackProductEvent } from '@utils/metrics.ts';
import type { ContentPage } from '@utils/markdown-content.ts';
import type { OnNavigate } from '../types/app.d.ts';

/**
 * Creates the featured-laws card shown after an article. Voting, sharing and
 * favorites work like every other law list; the card hides itself when the
 * category has no laws or the request fails.
 */
export function ArticleFeaturedLaws({ featuredCategory }: ArticleArchiveLinks): HTMLDivElement {
  const { el, renderLaws } = createLawListSection({
    accentText: 'Laws',
    remainderText: ' behind this story',
  });
  el.classList.add('article-featured-laws', 'mt-8');

  const footer = document.createElement('div');
  footer.className = 'card-footer';
  footer.innerHTML = renderArticleFeaturedLawsActions(featuredCategory);
  el.appendChild(footer);
  addCopyActionListeners(el);

  fetchLaws({ category_slug: featuredCategory.slug, limit: WIDGET_CARD_COUNT, sort: 'score', order: 'desc' })
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data.slice(0, WIDGET_CARD_COUNT) : [];
      el.toggleAttribute('hidden', laws.length === 0);
      renderLaws(laws, { limit: WIDGET_CARD_COUNT });
    })
    .catch(() => {
      el.toggleAttribute('hidden', true);
    });

  return el;
}

// Report a click on an archive button, a featured law, or its category chip
function trackArticleCtaClick(page: ContentPage, target: string, position: 'next_steps' | 'featured_laws'): void {
  trackPendoEvent('article_cta_clicked', { article: page, target, position });

  const category = /^\/category\/([^/?#]+)/.exec(target)?.[1];
  if (category) trackProductEvent('category.click', { surface: 'article', category });
}

/**
 * Adds the archive block to a rendered article view: the button row right after
 * `h1.page-title` (outside the article card, so in-prose link counts are unchanged)
 * and the featured-laws card after `article.content-card`. Pages without an
 * archive mapping are left unchanged. Navigation for `[data-nav]` links stays
 * with the view's own click handler.
 */
export function addArticleArchiveBlock(el: HTMLElement, page: ContentPage, onNavigate?: OnNavigate): void {
  const archive = getArticleArchiveLinks(page);
  if (!archive) return;

  el.querySelector('h1.page-title')?.insertAdjacentHTML('afterend', renderArticleNextSteps(archive));
  el.querySelector('article.content-card')?.after(ArticleFeaturedLaws(archive));

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const link = t.closest('.article-next-steps a[href][data-nav], .article-featured-laws a[href][data-nav]');
    if (link) {
      // The selector only matches links that carry an href
      trackArticleCtaClick(page, link.getAttribute('href')!, link.closest('.article-next-steps') ? 'next_steps' : 'featured_laws');
      return;
    }

    // As in other law lists, clicking a featured card outside its links and buttons opens the law
    const lawId = t.closest<HTMLElement>('.article-featured-laws .law-card-mini')?.dataset.lawId;
    if (!lawId || !onNavigate || t.closest('a, button, .share-wrapper')) return;
    trackArticleCtaClick(page, `/law/${lawId}`, 'featured_laws');
    onNavigate('law', lawId);
  });
}
