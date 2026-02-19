// HTML sanitization utilities

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(str: unknown): string {
  if (typeof str !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Highlights search terms in text while safely escaping HTML
 */
export function highlightSearchTerm(text: unknown, query: string): string {
  if (!text || typeof text !== 'string') return '';
  if (!query || !query.trim()) return escapeHtml(text);

  // Escape the text first
  const escapedText = escapeHtml(text);

  // Escape regex special characters in query
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create regex to match query (case insensitive)
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  // Highlight matches
  return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Strips markdown footnote references from text
 * Removes patterns like [^1], [^note], etc.
 */
export function stripMarkdownFootnotes(str: unknown): string {
  if (typeof str !== 'string') return '';
  // Remove footnote references like [^1], [^note], [^123]
  return str.replace(/\[\^[^\]]+\]/g, '').trim();
}

/**
 * Sanitizes a URL to prevent javascript: protocol attacks
 */
export function sanitizeUrl(url: unknown): string {
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
