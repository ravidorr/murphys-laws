// Gives the inline early Law of the Day script in index.html the API base the app is built with.
// The app requests `${API_BASE_URL}/api/v1/law-of-day` (src/utils/constants.ts, from VITE_API_URL, empty by default).
// The early request must go to the same place, or the app would adopt an answer from the wrong server.
import type { Plugin } from 'vite';

export const API_BASE_PLACEHOLDER = '__API_BASE_URL__';

/**
 * Replaces the placeholder inside the script's single-quoted string literal. The value is written as JavaScript string
 * content, with "<", ">", "&" and "'" as unicode escapes so it can never end the string or the script element.
 */
export function injectEarlyApiBase(html: string, apiBase: string): string {
  const escaped = JSON.stringify(apiBase)
    .slice(1, -1)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
  return html.split(API_BASE_PLACEHOLDER).join(escaped);
}

export function earlyApiBasePlugin(): Plugin {
  let apiBase = '';
  return {
    name: 'early-api-base',
    configResolved(config) {
      const value: unknown = config.env.VITE_API_URL;
      apiBase = typeof value === 'string' ? value : '';
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => injectEarlyApiBase(html, apiBase),
    },
  };
}
