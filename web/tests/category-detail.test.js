import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryDetail } from '../src/views/category-detail.js';
import * as api from '../src/utils/api.js';
import * as structuredData from '../src/modules/structured-data.js';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

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
  hydrateIcons: vi.fn(),
  createIcon: vi.fn(() => document.createElement('span'))
}));
vi.mock('../src/components/notification.js', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn()
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
        { id: 1, title: 'Technology', description: 'Tech truths: to err is human, to really foul things up requires a computer.' },
        { id: 2, title: 'Work', description: null }
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
      'name': expect.stringContaining('Technology Laws'),
      'description': 'Tech truths: to err is human, to really foul things up requires a computer.'
    }));
  });

  it('displays category description when available', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl).toBeTruthy();
    expect(descEl.textContent).toBe('Tech truths: to err is human, to really foul things up requires a computer.');
  });

  it('displays fallback description when description is null', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, title: 'Technology', description: null },
        { id: 2, title: 'Work', description: null }
      ]
    });

    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl).toBeTruthy();
    expect(descEl.textContent).toBe('All laws within this category.');
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

  it('does not navigate when clicking buttons inside law card', async () => {
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a law card element with a button inside
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '123';
    const button = document.createElement('button');
    button.setAttribute('data-action', 'favorite');
    lawCard.appendChild(button);
    el.appendChild(lawCard);
    
    // Reset the mock to clear any previous calls
    onNavigate.mockClear();

    // Click the button inside the card
    button.click();

    // Navigation should NOT be triggered when clicking buttons
    expect(onNavigate).not.toHaveBeenCalledWith('law', expect.anything());
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
    api.fetchCategories.mockRejectedValue(new Error('Network error'));
    
    CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('handles null data in fetchLaws response', async () => {
    api.fetchLaws.mockResolvedValue({ data: null, total: null });
    const el = CategoryDetail({ categoryId, onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No laws found');
  });

  it('handles category slug instead of numeric id', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'technology', title: 'Technology Laws', description: 'Tech laws' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'technology', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should use category_slug param instead of category_id
    expect(api.fetchLaws).toHaveBeenCalledWith(expect.objectContaining({
      category_slug: 'technology'
    }));

    // Should find category by slug and display its title
    expect(el.textContent).toContain('Technology Laws');
  });

  it('finds category by slug in fetchCategoryDetails', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'computers', title: "Murphy's Computers Laws", description: 'Computer laws description' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'computers', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should find the category by slug and use its title
    expect(el.textContent).toContain("Murphy's Computers Laws");
  });

  it('displays description when category found by slug', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'computers', title: "Murphy's Computers Laws", description: 'Digital doom: programs are obsolete when running.' },
        { id: 2, slug: 'work', title: 'Work Laws', description: 'Work laws' }
      ]
    });

    const el = CategoryDetail({ categoryId: 'computers', onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const descEl = el.querySelector('#category-description');
    expect(descEl.textContent).toBe('Digital doom: programs are obsolete when running.');
  });

  describe('copy actions', () => {
    it('copies law text to clipboard when copy text button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('Test law text');
    });

    it('copies law link to clipboard when copy link button is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 10));

      expect(writeTextMock).toHaveBeenCalledWith('https://test.com/law/1');
    });

    it('uses fallback when clipboard API fails on copy text', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyTextBtn = document.createElement('button');
      copyTextBtn.setAttribute('data-action', 'copy-text');
      copyTextBtn.setAttribute('data-copy-value', 'Test law text');
      el.appendChild(copyTextBtn);

      copyTextBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });

    it('uses fallback when clipboard API fails on copy link', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
      Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

      const execCommandMock = vi.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      const el = CategoryDetail({ categoryId, onNavigate });
      await new Promise(resolve => setTimeout(resolve, 10));

      const copyLinkBtn = document.createElement('button');
      copyLinkBtn.setAttribute('data-action', 'copy-link');
      copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/1');
      el.appendChild(copyLinkBtn);

      copyLinkBtn.click();
      await new Promise(r => setTimeout(r, 50));

      expect(writeTextMock).toHaveBeenCalled();
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
  });
});
