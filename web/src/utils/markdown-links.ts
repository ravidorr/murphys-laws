// Shared marked link renderer for site Markdown, used by the client
// (markdown-content.ts) and the static site generator (scripts/ssg.ts).

import type { MarkedExtension } from 'marked';

const SITE_HOST = 'murphys-laws.com';
const NEW_TAB_NOTICE = '<span class="visually-hidden"> (opens in a new tab)</span>';

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** True for absolute http(s) links whose host is not murphys-laws.com. */
export function isExternalLink(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Site-relative ("/category/...") and fragment links are not absolute URLs
    return false;
  }
  const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
  return isWeb && url.hostname.replace(/^www\./, '') !== SITE_HOST;
}

/**
 * External citations open in a new tab, so a reader who checks one keeps the
 * article (and its archive links) open. Site links keep marked's default output.
 */
export const externalLinkRenderer: MarkedExtension = {
  renderer: {
    link({ href, title, tokens }) {
      if (!isExternalLink(href)) return false;

      const text = this.parser.parseInline(tokens);
      const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
      return `<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${text}${NEW_TAB_NOTICE}</a>`;
    },
  },
};
