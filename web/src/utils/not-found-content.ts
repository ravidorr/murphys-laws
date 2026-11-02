import { DEFAULT_NOT_FOUND_LINE } from './not-found-lines.ts';

/** The few law fields the 404 cards need. Both the app and SSG law types satisfy it. */
export interface NotFoundLaw {
  id: number | string;
  title?: string | null;
  text?: string;
  attributions?: Array<{ name?: string | null }>;
}

export const NOT_FOUND_LAW_COUNT = 3;

// Pure string escaping: the SSG build runs in Node, where sanitize.ts (DOM based) is unavailable.
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/** Law cards shown on the 404 page. Shared by the SSG build and the in-app view. */
export function renderNotFoundLaws(laws: readonly NotFoundLaw[]): string {
  return laws
    .slice(0, NOT_FOUND_LAW_COUNT)
    .map((law) => {
      const text = escapeHtml(law.title ? `${law.title}: ${law.text ?? ''}` : (law.text ?? ''));
      const attribution = law.attributions?.[0]?.name;
      const meta = attribution
        ? `<p class="not-found-law-meta">- ${escapeHtml(attribution)}</p>`
        : '';
      return `<article class="not-found-law">
          <p class="not-found-law-text"><a href="/law/${escapeHtml(String(law.id))}">${text}</a></p>
          ${meta}
        </article>`;
    })
    .join('');
}

/** Page body for the 404 view. The caller supplies the site shell around it. */
export function renderNotFoundContent(options: {
  line?: string;
  lawsHtml?: string;
} = {}): string {
  const { line = DEFAULT_NOT_FOUND_LINE, lawsHtml = '' } = options;
  return `
      <p class="not-found-code" aria-hidden="true">404</p>
      <h1 class="not-found-title"><span class="accent-text">Page</span> Not Found</h1>
      <blockquote class="not-found-quote" data-not-found-line>${escapeHtml(line)}</blockquote>
      <p class="not-found-description">The page you requested could not be found or may have moved. Try a search, or pick a way back into the archive.</p>
      <section class="not-found-laws-section" aria-labelledby="not-found-laws-title"${lawsHtml ? '' : ' hidden'}>
        <h2 id="not-found-laws-title" class="not-found-laws-title"><span class="accent-text">Try</span> one of these laws instead</h2>
        <div class="not-found-laws" data-not-found-laws>${lawsHtml}</div>
      </section>`;
}
