/**
 * SEO utility functions
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
