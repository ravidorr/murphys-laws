import { renderButtonHTML } from './button.ts';

/**
 * Renders pagination controls for navigating through paginated data
 */
export function renderPagination(currentPage: number, totalItems: number, itemsPerPage: number): string {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return '';

  const pages: (number | string)[] = [];

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
    return renderButtonHTML({
      variant: 'secondary',
      text: String(p),
      page: p as number,
      ariaCurrent: isCurrent ? 'page' : null,
    });
  }).join('');

  const prevBtn = renderButtonHTML({
    variant: 'secondary',
    text: 'Previous',
    page: currentPage - 1,
    disabled: currentPage === 1,
    ariaDisabled: currentPage === 1 ? true : null,
  });

  const nextBtn = renderButtonHTML({
    variant: 'secondary',
    text: 'Next',
    page: currentPage + 1,
    disabled: currentPage === totalPages,
    ariaDisabled: currentPage === totalPages ? true : null,
  });

  return `
    <div class="pagination">
      ${prevBtn}
      ${pageButtons}
      ${nextBtn}
    </div>
  `;
}
