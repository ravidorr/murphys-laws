/**
 * Law page SEO metadata (title, description, schema headline).
 *
 * Shared by the web static site generator, the web client router and the backend fallback that
 * serves laws published after the last static build, so all three produce the same metadata.
 * Keep this module free of imports so every package can load it.
 */

/**
 * Truncate title to fit within 60 character limit for SEO
 * Accounts for the " - Murphy's Law Archive" suffix (24 chars)
 */
export function truncateTitle(title: string, suffix = " - Murphy's Law Archive"): string {
  const maxLength = 60;
  const maxTitleLength = maxLength - suffix.length;

  if (title.length <= maxTitleLength) {
    return title;
  }

  // Truncate and add ellipsis, ensuring we don't cut mid-word
  let truncated = title.substring(0, maxTitleLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0 && lastSpace > maxTitleLength / 2) {
    truncated = truncated.substring(0, lastSpace);
  }
  return truncated + '...';
}

const SITE_TITLE_SUFFIX = " - Murphy's Law Archive";
const MAX_DESCRIPTION_LENGTH = 155;
const HARD_DESCRIPTION_LIMIT = 160;
const MAX_TITLE_LENGTH = 60;
const MIN_DESCRIPTION_LENGTH = 110;
const MAX_HEADLINE_LENGTH = 110;
const GENERIC_LAW_TITLES = new Set([
  "murphy's law",
  'murphys law',
  "murphy's laws",
  'corollary',
  'law',
  'untitled'
]);

export interface LawSeoInput {
  id: number | string;
  title?: string | null;
  text?: string | null;
  category_name?: string | null;
}

export interface LawSeo {
  /** Full `<title>` including the site suffix, at most 60 characters unless an id disambiguator is required. */
  title: string;
  /** Meta description, 110 to 155 characters when the law text allows it. */
  description: string;
  /** Schema.org headline and breadcrumb name (at most 110 characters). */
  headline: string;
}

export interface LawSeoOptions {
  /** Append the law id to the title so it stays unique among laws with identical text. */
  disambiguateTitle?: boolean;
  /** Append the law id to the description so it stays unique among laws with identical text. */
  disambiguateDescription?: boolean;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Shorten text to at most `max` characters, cutting at a word boundary and appending an ellipsis.
 */
export function cutAtWord(value: string, max: number, ellipsis = true): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const room = ellipsis ? max - 3 : max;
  let cut = text.substring(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > room / 2) cut = cut.substring(0, lastSpace);
  return `${cut.replace(/[\s.,;:!?-]+$/, '')}${ellipsis ? '...' : ''}`;
}

/**
 * Laws titled "Murphy's Law" or "Corollary" carry no information of their own.
 */
export function isGenericLawTitle(title?: string | null): boolean {
  const normalized = collapseWhitespace(title || '').toLowerCase();
  return normalized === '' || GENERIC_LAW_TITLES.has(normalized);
}

function lawBaseName(law: LawSeoInput): string {
  const text = collapseWhitespace(law.text || '').replace(/[.!?:;,]+$/, '');
  if (!isGenericLawTitle(law.title)) return collapseWhitespace(law.title as string);
  return text || `Murphy's Law #${law.id}`;
}

/**
 * A short name for listing a law where the page title would be too long, such as a corollary card or the banner on a
 * corollary's page. Laws with a generic title ("Corollary", "Murphy's Law") are named from their text, the same way
 * their head title is, so a list of corollaries does not read "Corollary, Corollary, Corollary".
 */
export function lawDisplayTitle(law: LawSeoInput, max = 90): string {
  return cutAtWord(lawBaseName(law), max);
}

function buildLawDescription(law: LawSeoInput, disambiguate: boolean): string {
  let description = collapseWhitespace(law.text || '');
  if (!description) {
    description = "A Murphy's Law from the Murphy's Law Archive.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    description = cutAtWord(description, MAX_DESCRIPTION_LENGTH);
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    const sentence = /[.!?"')]$/.test(description) ? description : `${description.replace(/[:;,]+$/, '')}.`;
    const category = collapseWhitespace(law.category_name || '');
    const context = category
      ? ` A Murphy's Law from the ${category} category.`
      : " From the Murphy's Law Archive.";
    const withContext = `${sentence}${context}`;
    description = withContext.length <= HARD_DESCRIPTION_LIMIT
      ? withContext
      : `${sentence} From the Murphy's Law Archive.`;
  }

  if (disambiguate) {
    const tag = ` (Law #${law.id})`;
    description = `${cutAtWord(description, HARD_DESCRIPTION_LIMIT - tag.length, false)}${tag}`;
  }
  return description;
}

/**
 * Build the SEO title, description and schema headline for a law page.
 * Shared by the static site generator and the client router so both agree.
 */
export function buildLawSeo(law: LawSeoInput, options: LawSeoOptions = {}): LawSeo {
  const base = lawBaseName(law);
  const tag = options.disambiguateTitle ? ` #${law.id}` : '';
  const suffix = `${tag}${SITE_TITLE_SUFFIX}`;
  // A disambiguated title ends in the id, so cut the text cleanly instead of adding an ellipsis before it
  const shownBase = tag ? cutAtWord(base, MAX_TITLE_LENGTH - suffix.length, false) : truncateTitle(base, suffix);
  return {
    title: `${shownBase}${suffix}`,
    description: buildLawDescription(law, Boolean(options.disambiguateDescription)),
    headline: cutAtWord(base, MAX_HEADLINE_LENGTH)
  };
}

/**
 * Build SEO metadata for every law and disambiguate the ones whose title or description
 * would otherwise collide with another law.
 */
export function buildUniqueLawSeo(laws: LawSeoInput[]): Map<string, LawSeo> {
  const first = laws.map((law) => buildLawSeo(law));
  const titleCounts: Record<string, number> = {};
  const descriptionCounts: Record<string, number> = {};
  for (const seo of first) {
    titleCounts[seo.title] = (titleCounts[seo.title] || 0) + 1;
    descriptionCounts[seo.description] = (descriptionCounts[seo.description] || 0) + 1;
  }

  const result = new Map<string, LawSeo>();
  laws.forEach((law, index) => {
    const seo = first[index] as LawSeo;
    const disambiguateTitle = (titleCounts[seo.title] as number) > 1;
    const disambiguateDescription = (descriptionCounts[seo.description] as number) > 1;
    result.set(
      String(law.id),
      disambiguateTitle || disambiguateDescription
        ? buildLawSeo(law, { disambiguateTitle, disambiguateDescription })
        : seo
    );
  });
  return result;
}
