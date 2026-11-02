/**
 * SEO utility functions
 */
import { SITE_URL } from './constants.ts';

export function buildCanonicalUrl(pathOrUrl: string): string {
  const base = new URL(SITE_URL);
  const input = pathOrUrl.startsWith('http')
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`, base);
  input.protocol = base.protocol;
  input.host = base.host;
  input.search = '';
  input.hash = '';
  return input.toString().replace(/\/$/, input.pathname === '/' ? '/' : '');
}

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
export function cutAtWord(value: string, max: number): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const room = max - 3;
  let cut = text.substring(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > room / 2) cut = cut.substring(0, lastSpace);
  return `${cut.replace(/[\s.,;:!?-]+$/, '')}...`;
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
    description = `${cutAtWord(description, HARD_DESCRIPTION_LIMIT - tag.length)}${tag}`;
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
  return {
    title: `${truncateTitle(base, suffix)}${suffix}`,
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

export interface BreadcrumbItem {
  name: string;
  /** Site-relative path such as `/categories`; use `/` for the home page. */
  path: string;
}

/**
 * Build a schema.org BreadcrumbList for the given trail (home first).
 */
export function buildBreadcrumbList(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.path === '/' ? SITE_URL : `${SITE_URL}${item.path}`
    }))
  };
}
