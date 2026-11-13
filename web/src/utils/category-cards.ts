// Category card and cluster markup shared by the categories view and the SSG pre-render, so the two stay in step.

import { groupCategories } from './category-groups.ts';
import { getCategoryDisplayName } from './constants.ts';
import { escapeHtml } from '@shared/modules/html-escape.ts';
import { stripMarkdownFootnotes } from './sanitize.ts';

export interface CategoryCardSource {
  slug: string;
  title: string;
  description?: string | null;
  law_count?: number;
}

const FALLBACK_DESCRIPTION = 'Explore laws in this category.';

/** The card's visible text, kept apart from the markup so the aria-label and the card cannot drift. */
function describeCategory(category: CategoryCardSource) {
  const title = getCategoryDisplayName(category.slug, stripMarkdownFootnotes(category.title));
  const description = stripMarkdownFootnotes(category.description || '').trim() || FALLBACK_DESCRIPTION;
  const lawCount = category.law_count || 0;
  return { title, description, lawCount, lawText: lawCount === 1 ? 'law' : 'laws' };
}

/**
 * One category card. The whole card is the link; it has no underline at rest. The cue for sighted pointer users is the
 * title underline on hover, and the always-visible arrow tells touch users the card opens.
 */
export function renderCategoryCard(category: CategoryCardSource): string {
  const { title, description, lawCount, lawText } = describeCategory(category);

  return `<a href="/category/${escapeHtml(category.slug)}" class="card card--category category-card category-card--rich" data-category-slug="${escapeHtml(category.slug)}" aria-label="${escapeHtml(title)} - ${lawCount} ${lawText}">
        <h3 class="category-card-title">${escapeHtml(title)}</h3>
        <p class="category-card-description">${escapeHtml(description)}</p>
        <div class="category-card-footer">
          <span class="category-card-count">${lawCount} ${lawText}</span>
          <span class="category-card-arrow" aria-hidden="true"></span>
        </div>
      </a>`;
}

function clusterId(name: string): string {
  return `category-cluster-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** Every group as a full-width section with its own grid of cards, stacked one under the other. */
export function renderCategoryClusters(categories: CategoryCardSource[]): string {
  return groupCategories(categories)
    .map((group) => `<section class="category-cluster" data-category-cluster="${escapeHtml(group.name)}" aria-labelledby="${clusterId(group.name)}">
          <header class="category-cluster-header">
            <h2 id="${clusterId(group.name)}" class="category-cluster-title">${escapeHtml(group.name)}</h2>
            <p class="category-cluster-description">${escapeHtml(group.description)}</p>
          </header>
          <div class="categories-grid">
            ${group.categories.map(renderCategoryCard).join('\n            ')}
          </div>
        </section>`)
    .join('\n        ');
}
