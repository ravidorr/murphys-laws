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

export {
  buildLawSeo,
  buildUniqueLawSeo,
  cutAtWord,
  isGenericLawTitle,
  lawDisplayTitle,
  truncateTitle
} from '@shared/modules/law-seo.ts';
export type { LawSeo, LawSeoInput, LawSeoOptions } from '@shared/modules/law-seo.ts';

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
