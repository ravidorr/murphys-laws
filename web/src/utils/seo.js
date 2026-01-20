/**
 * SEO utility functions
 */

/**
 * Truncate title to fit within 70 character limit for SEO
 * Accounts for the " - Murphy's Law Archive" suffix (24 chars)
 * @param {string} title - The title to truncate
 * @param {string} suffix - The suffix to append (default: " - Murphy's Law Archive")
 * @returns {string} - The truncated title (without suffix)
 */
export function truncateTitle(title, suffix = " - Murphy's Law Archive") {
  const maxLength = 70;
  const maxTitleLength = maxLength - suffix.length;
  
  if (title.length <= maxTitleLength) {
    return title;
  }
  
  // Truncate and add ellipsis, ensuring we don't cut mid-word
  let truncated = title.substring(0, maxTitleLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxTitleLength / 2) {
    truncated = truncated.substring(0, lastSpace);
  }
  return truncated + '...';
}
