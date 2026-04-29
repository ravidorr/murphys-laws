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
