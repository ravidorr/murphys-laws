import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Categories } from '../src/views/categories.js';
import * as api from '../src/utils/api.js';
import * as structuredData from '../src/modules/structured-data.js';

// Mock dependencies
vi.mock('../src/utils/api.js', () => ({
  fetchCategories: vi.fn()
}));
vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/icons.js', () => ({
  hydrateIcons: vi.fn()
}));
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  getRandomLoadingMessage: () => 'Loading...'
}));

describe('Categories view', () => {
  let onNavigate;

  beforeEach(() => {
    onNavigate = vi.fn();
    vi.clearAllMocks();
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, title: 'Technology', description: 'Tech laws', law_count: 10 },
        { id: 2, title: 'Work', description: 'Work laws', law_count: 5 }
      ]
    });
  });

  it('renders loading state initially', () => {
    const el = Categories({ onNavigate });
    expect(el.innerHTML).toContain('Loading...');
    expect(el.querySelector('#categories-list')).toBeTruthy();
  });

  it('fetches and renders categories', async () => {
    const el = Categories({ onNavigate });
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchCategories).toHaveBeenCalled();
    expect(el.textContent).toContain('Technology');
    expect(el.textContent).toContain('Work');
    expect(el.textContent).toContain('10 laws');
  });

  it('renders empty state when no categories found', async () => {
    api.fetchCategories.mockResolvedValue({ data: [] });
    const el = Categories({ onNavigate });
    
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No categories found');
  });

  it('handles API error gracefully', async () => {
    api.fetchCategories.mockRejectedValue(new Error('Network error'));
    const el = Categories({ onNavigate });
    
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Failed to load categories');
  });

  it('sets structured data', async () => {
    Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(structuredData.setJsonLd).toHaveBeenCalledWith('categories-page', expect.objectContaining({
      '@type': 'CollectionPage',
      'name': "Browse Murphy's Law Categories"
    }));
  });

  it('navigates to category detail on click', async () => {
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const viewBtn = el.querySelector('[data-nav="category:1"]');
    expect(viewBtn).toBeTruthy();
    viewBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('category', '1');
  });
});
