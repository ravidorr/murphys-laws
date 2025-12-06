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
    
    // But checking the listener logic:
    // This variable is no longer needed after refactoring event simulation
    // const clickEvent = {
    //   target: nextBtn,
    //   preventDefault: vi.fn(),
    //   stopPropagation: vi.fn(),
    //   bubbles: true
    // };
    
    // Trigger the listener directly since simulating real events is flaky in this environment setup
    // Find the listener... simplified approach: check if we can trigger it via dispatchEvent on a child
    // But since we don't have the full DOM structure rendered by renderPagination (it's mocked or complex),
    // let's simulate the event bubbling to the container 'el'
    
    // We need to append the button to 'el' so 'closest' works
    el.appendChild(nextBtn);
    
    nextBtn.dispatchEvent(new Event('click', { bubbles: true }));
    
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      offset: 10 // Page 2 offset
    }));
  });
});
