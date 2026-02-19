import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Browse } from '../src/views/browse.js';

describe('Browse view - Coverage', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Mock fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 })
    });
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it('updates widgets visibility when search filters are active', async () => {
    // We need to trigger the internal callback of AdvancedSearch
    // In browse.js: onSearch: (filters) => { currentFilters = filters; updateWidgetsVisibility(); ... }
    
    // Create view with initial query
    const el = Browse({ searchQuery: 'test', onNavigate: () => {} });
    container.appendChild(el);
    
    // Force a wait for the internal components to render
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Widgets should be hidden because currentFilters.q is 'test'
    const widgets = el.querySelector('[data-widgets]');
    expect(widgets.hasAttribute('hidden')).toBe(true);
  });

  it('handles empty laws array in loadPage', async () => {
    // Mock return empty data
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], total: 0 })
    } as Response);
    
    const el = Browse({ searchQuery: '', onNavigate: () => {} });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Check if empty state is shown
    expect(el.innerHTML).toContain('Murphy spared these results');
  });
  
  it('handles fetch errors in loadPage', async () => {
    // Set mock to reject for all calls to ensure it hits the error branch
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('API Failure'));
    
    const el = Browse({ searchQuery: '', onNavigate: () => {} });
    container.appendChild(el);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if error state is shown in the correct list container
    const list = el.querySelector('#browse-laws-list');
    expect(list.innerHTML).toContain('Ironically');
  });
});
