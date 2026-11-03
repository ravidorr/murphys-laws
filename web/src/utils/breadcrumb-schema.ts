// Shared BreadcrumbList JSON-LD builder used by the client router and the SSG prerenderer.

import { SITE_URL } from './constants.ts';

export interface BreadcrumbTrailItem {
  name: string;
  path: string;
}

/**
 * Build a BreadcrumbList object. Home is always the first item; paths must start with "/"
 * and are made absolute.
 */
export function buildBreadcrumbList(trail: BreadcrumbTrailItem[]): Record<string, unknown> {
  const items = [{ name: 'Home', path: '' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': `${SITE_URL}${item.path}`
    }))
  };
}
