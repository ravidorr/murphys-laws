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

  it('renders category without description', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, title: 'No Description Category', law_count: 3 }
      ]
    });
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No Description Category');
    expect(el.textContent).toContain('3 laws');
  });

  it('handles non-category navigation', async () => {
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a non-category nav button
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'about');
    el.appendChild(navBtn);
    
    navBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('about');
  });

  it('handles null API response data', async () => {
    api.fetchCategories.mockResolvedValue({ data: null });
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No categories found');
  });

  it('ignores click on element without data-nav', async () => {
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const regularBtn = document.createElement('button');
    el.appendChild(regularBtn);
    
    regularBtn.click();

    // onNavigate should only be called for elements with data-nav
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores click with non-Element target', async () => {
    const el = Categories({ onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Simulate click event with non-Element target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
