// HTML sanitization utilities

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for innerHTML
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Highlights search terms in text while safely escaping HTML
 * @param {string} text - Text to highlight in
 * @param {string} query - Search query to highlight
 * @returns {string} HTML string with highlighted terms
 */
export function highlightSearchTerm(text, query) {
  if (!text || typeof text !== 'string') return '';
  if (!query || !query.trim()) return escapeHtml(text);

  // Escape the text first
  const escapedText = escapeHtml(text);

  // Escape regex special characters in query
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create regex to match query (case insensitive)
  const regex = new RegExp(`(${escapeHtml(escapedQuery)})`, 'gi');

  // Highlight matches
  return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Sanitizes a URL to prevent javascript: protocol attacks
 * @param {string} url - URL to sanitize
 * @returns {string} Safe URL or empty string
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:')) {
    return '';
  }

  return url;
}
