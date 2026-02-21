import { describe, it, expect } from 'vitest';
import { renderPagination } from '../src/utils/pagination.js';

describe('pagination utils', () => {
  it('returns empty string when totalPages <= 1', () => {
    expect(renderPagination(1, 10, 25)).toBe('');
    expect(renderPagination(1, 0, 25)).toBe('');
  });

  it('renders pagination with ellipsis when many pages', () => {
    const html = renderPagination(5, 100, 10);
    expect(html).toContain('ellipsis');
    expect(html).toContain('Previous');
    expect(html).toContain('Next');
  });

  it('includes first and last page when start > 2', () => {
    const html = renderPagination(5, 100, 10);
    expect(html).toContain('>1<');
    expect(html).toContain('>10<');
  });
});
