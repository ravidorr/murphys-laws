import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryDetail } from '../src/views/category-detail.js';
import * as api from '../src/utils/api.js';
import * as structuredData from '../src/modules/structured-data.js';

// Mock dependencies
vi.mock('../src/utils/api.js', () => ({
  fetchLaws: vi.fn(),
  fetchCategories: vi.fn()
}));
vi.mock('../src/utils/law-card-renderer.js', () => ({
  renderLawCards: vi.fn((laws) => laws.map(l => `<div>${l.title}</div>`).join(''))
}));
vi.mock('../src/modules/structured-data.js');
vi.mock('../src/utils/icons.js', () => ({
  hydrateIcons: vi.fn()
}));
vi.mock('../src/utils/constants.js', () => ({
  SITE_URL: 'https://murphys-laws.com',
  SITE_NAME: "Murphy's Law Archive",
  LAWS_PER_PAGE: 10,
  getRandomLoadingMessage: () => 'Loading...'
}));
vi.mock('../src/utils/voting.js', () => ({
  addVotingListeners: vi.fn()
}));

describe('CategoryDetail view', () => {
  let onNavigate;
  const categoryId = 1;

  beforeEach(() => {
    onNavigate = vi.fn();
    vi.clearAllMocks();
    
    api.fetchLaws.mockResolvedValue({
      data: [
        { id: 101, title: 'Law 1', text: 'Text 1', score: 5 },
        { id: 102, title: 'Law 2', text: 'Text 2', score: 3 }
      ],
      total: 2
    });

    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, title: 'Technology' },
        { id: 2, title: 'Work' }
      ]
    });
  });

  it('renders initial structure', () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    expect(el.querySelector('#category-laws-list')).toBeTruthy();
    expect(el.innerHTML).toContain('Loading...');
  });

  it('fetches category details and laws', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    // Wait for fetchCategoryDetails().then(() => loadPage(1))
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchCategories).toHaveBeenCalled();
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      category_id: 1,
      limit: 10
    }));

    expect(el.textContent).toContain("Technology's Laws");
    expect(el.textContent).toContain('Law 1');
    expect(el.textContent).toContain('Law 2');
  });

  it('sets structured data with breadcrumbs', async () => {
    CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(structuredData.setJsonLd).toHaveBeenCalledWith('category-detail-breadcrumbs', expect.objectContaining({
      '@type': 'BreadcrumbList'
    }));
    expect(structuredData.setJsonLd).toHaveBeenCalledWith('category-detail-page', expect.objectContaining({
      '@type': 'CollectionPage',
      'name': expect.stringContaining('Technology Laws')
    }));
  });

  it('renders empty state when no laws found', async () => {
    api.fetchLaws.mockResolvedValue({ data: [], total: 0 });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No laws found');
  });

  it('handles API error', async () => {
    api.fetchLaws.mockRejectedValue(new Error('Network error'));
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Of course something went wrong');
  });

  it('handles pagination', async () => {
    api.fetchLaws.mockResolvedValue({
      data: [],
      total: 20 // Enough for 2 pages
    });
    
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const nextBtn = document.createElement('button');
    nextBtn.dataset.page = '2';
    
    // We need to append the button to 'el' so 'closest' works
    el.appendChild(nextBtn);
    
    nextBtn.dispatchEvent(new Event('click', { bubbles: true }));
    
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      offset: 10 // Page 2 offset
    }));
  });

  it('handles law card click navigation', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    lawCard.click();

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('handles law card keyboard navigation with Enter key (WCAG 2.1.1)', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    lawCard.dispatchEvent(enterEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('handles law card keyboard navigation with Space key (WCAG 2.1.1)', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    el.appendChild(lawCard);
    
    // Simulate Space key press
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    lawCard.dispatchEvent(spaceEvent);

    expect(onNavigate).toHaveBeenCalledWith('law', '123');
  });

  it('handles navigation button click', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', 'submit');
    el.appendChild(navBtn);
    
    navBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

  it('ignores disabled pagination button', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    api.fetchLaws.mockClear();

    const disabledBtn = document.createElement('button');
    disabledBtn.dataset.page = '2';
    disabledBtn.setAttribute('disabled', 'true');
    el.appendChild(disabledBtn);
    
    disabledBtn.click();

    // Should not trigger a new fetch since button is disabled
    expect(api.fetchLaws).not.toHaveBeenCalled();
  });

  it('ignores invalid page number', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    api.fetchLaws.mockClear();

    const invalidBtn = document.createElement('button');
    invalidBtn.dataset.page = '0'; // Invalid page
    el.appendChild(invalidBtn);
    
    invalidBtn.click();

    expect(api.fetchLaws).not.toHaveBeenCalled();
  });

  it('handles non-Element click target', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);

    // Should not throw and onNavigate not called
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('handles category not found in categories list', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 999, title: 'Other Category' }
      ]
    });
    const el = CategoryDetail({ categoryId: 1, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should still render with default "Category" title
    expect(el.querySelector('#category-detail-title')).toBeTruthy();
  });

  it('handles fetchCategories error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fetchCategories.mockRejectedValue(new Error('Network error'));
    
    CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch category details:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles null data in fetchLaws response', async () => {
    api.fetchLaws.mockResolvedValue({ data: null, total: null });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No laws found');
  });
});
