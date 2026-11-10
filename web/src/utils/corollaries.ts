// Markup for the corollary pieces of the law page: the Corollaries list on a parent law and the "Corollary of"
// banner on a corollary. The client view and the static site generator both render through these functions, so the
// page a crawler or a no-JS reader sees has the same structure as the one the app builds.

// The DOM-free escape: the static site generator runs this module in Node, where sanitize.ts cannot be used because
// it needs `document`.
import { escapeHtml } from '@shared/modules/html-escape.ts';
import { cutAtWord, isGenericLawTitle, lawDisplayTitle } from './seo.ts';
import { getUserVote } from './voting.ts';
import { renderButtonHTML } from './button.ts';
import type { Corollary, CorollaryParent } from '../types/app.d.ts';

/** Longest name shown for a corollary or its parent in a card or banner. */
const DISPLAY_TITLE_MAX = 90;
/** Longest piece of the parent's text shown under its name in the banner. */
const PARENT_EXCERPT_MAX = 110;

interface TitledLaw {
  id: number;
  title?: string | null;
  text: string;
}

/**
 * The name a corollary goes by where the page title would be too long. Many corollaries are titled just "Corollary",
 * so those are named from their text, the same rule that feeds their head title.
 */
export function corollaryDisplayTitle(law: TitledLaw): string {
  return lawDisplayTitle(law, DISPLAY_TITLE_MAX);
}

/** "1 consequence of this law" / "2 consequences of this law". */
export function corollaryCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'consequence' : 'consequences'} of this law`;
}

/** A card repeats its text under the name only when the name was not already taken from the whole text. */
function showsTextBelowTitle(law: TitledLaw): boolean {
  return !isGenericLawTitle(law.title) || law.text.length > DISPLAY_TITLE_MAX;
}

function renderVoteGroup(corollary: Corollary): string {
  const safeId = escapeHtml(String(corollary.id));
  const userVote = getUserVote(corollary.id);
  const up = Number.isFinite(corollary.upvotes) ? corollary.upvotes : 0;
  const down = Number.isFinite(corollary.downvotes) ? corollary.downvotes : 0;
  return `<div class="vote-group" role="group" aria-label="Vote. Votes are anonymous; no login required.">
        ${renderButtonHTML({
    variant: 'vote',
    direction: 'up',
    icon: 'thumbUp',
    count: up,
    vote: 'up',
    lawId: safeId,
    className: userVote === 'up' ? 'voted' : null,
    ariaLabel: `Upvote corollary: ${escapeHtml(corollaryDisplayTitle(corollary))}`,
  })}
        ${renderButtonHTML({
    variant: 'vote',
    direction: 'down',
    icon: 'thumbDown',
    count: down,
    vote: 'down',
    lawId: safeId,
    className: userVote === 'down' ? 'voted' : null,
    ariaLabel: `Downvote corollary: ${escapeHtml(corollaryDisplayTitle(corollary))}`,
  })}
      </div>`;
}

/**
 * One card per corollary: a linked name, its text and a vote control. The static site has no scripts, so
 * `interactive: false` swaps the vote buttons for plain counts.
 */
export function renderCorollaryCards(corollaries: readonly Corollary[], { interactive }: { interactive: boolean }): string {
  return corollaries.map((corollary) => {
    const safeId = escapeHtml(String(corollary.id));
    const title = escapeHtml(corollaryDisplayTitle(corollary));
    const text = showsTextBelowTitle(corollary)
      ? `\n      <p class="corollary-card-text">${escapeHtml(corollary.text)}</p>`
      : '';
    const votes = interactive
      ? renderVoteGroup(corollary)
      : `<p class="corollary-card-count small">${Number(corollary.upvotes) || 0} up, ${Number(corollary.downvotes) || 0} down</p>`;
    return `
    <article class="corollary-card" data-law-id="${safeId}">
      <div class="corollary-card-body">
        <h3 class="corollary-card-title"><a href="/law/${safeId}" data-corollary-link data-law-id="${safeId}">${title}</a></h3>${text}
      </div>
      ${votes}
    </article>`;
  }).join('');
}

/** The whole Corollaries section for a parent law, or an empty string when it has none. */
export function renderCorollarySection(corollaries: readonly Corollary[], { interactive }: { interactive: boolean }): string {
  if (corollaries.length === 0) return '';
  return `<section class="corollary-list mb-12" aria-labelledby="corollaries-heading" data-corollaries>
      <div class="corollary-list-header">
        <h2 id="corollaries-heading" class="section-title" data-section-title="Corollaries"><span class="accent-text">Corollaries</span></h2>
        <span class="corollary-list-count small">${corollaryCountLabel(corollaries.length)}</span>
      </div>
      <div class="corollary-list-items" data-corollaries-list>${renderCorollaryCards(corollaries, { interactive })}</div>
    </section>`;
}

/** The "Corollary of" banner for a corollary's own page, linking up to its parent. */
export function renderParentBanner(parent: CorollaryParent): string {
  const safeId = escapeHtml(String(parent.id));
  const title = escapeHtml(corollaryDisplayTitle(parent));
  const excerpt = showsTextBelowTitle(parent)
    ? `<span class="parent-banner-excerpt">${escapeHtml(cutAtWord(parent.text, PARENT_EXCERPT_MAX))}</span>`
    : '';
  return `<a class="parent-banner" href="/law/${safeId}" data-parent-link data-law-id="${safeId}">
      <span class="parent-banner-label">Corollary of</span>
      <span class="parent-banner-title">${title}</span>
      ${excerpt}
    </a>`;
}
