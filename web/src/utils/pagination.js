/**
 * Renders pagination controls for navigating through paginated data
 * @param {number} currentPage - The current page number (1-indexed)
 * @param {number} totalItems - Total number of items across all pages
 * @param {number} itemsPerPage - Number of items to display per page
 * @returns {string} HTML string for pagination controls, or empty string if only one page
 */
export function renderPagination(currentPage, totalItems, itemsPerPage) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return '';

  let pages = [];

  // Always show first page
  pages.push(1);

  // Show pages around current page
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('...');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page if there's more than one page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  const pageButtons = pages.map(p => {
    if (p === '...') {
      return `<span class="ellipsis">…</span>`;
    }
    const isCurrent = p === currentPage;
    const disabled = isCurrent ? 'aria-current="page"' : '';
    return `<button class="btn outline" data-page="${p}" ${disabled}>${p}</button>`;
  }).join('');

  const prevDisabled = currentPage === 1 ? 'disabled aria-disabled="true"' : '';
  const nextDisabled = currentPage === totalPages ? 'disabled aria-disabled="true"' : '';

  return `
    <div class="pagination">
      <button class="btn outline" data-page="${currentPage - 1}" ${prevDisabled}>Previous</button>
      ${pageButtons}
      <button class="btn outline" data-page="${currentPage + 1}" ${nextDisabled}>Next</button>
    </div>
  `;
}
