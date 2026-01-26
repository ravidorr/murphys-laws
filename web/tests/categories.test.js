import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Categories } from '../src/views/categories.js';
import * as api from '../src/utils/api.js';

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

// Mock dependencies
vi.mock('../src/utils/api.js', () => ({
  fetchCategories: vi.fn()
}));
vi.mock('../src/utils/icons.js', () => ({
  hydrateIcons: vi.fn(),
  createIcon: vi.fn(() => document.createElement('span'))
}));
vi.mock('../src/utils/constants.js', () => ({
  getRandomLoadingMessage: () => 'Loading...'
}));
vi.mock('../src/utils/sanitize.js', () => ({
  stripMarkdownFootnotes: vi.fn((text) => text)
}));

describe('Categories view', () => {
  const localThis = {};

  beforeEach(() => {
    localThis.onNavigate = vi.fn();
    vi.clearAllMocks();

    api.fetchCategories.mockResolvedValue({
      data: [
        { 
          id: 1, 
          slug: 'murphys-computer-laws', 
          title: "Murphy's Computer Laws", 
          description: 'Digital doom: programs are obsolete when running.',
          law_count: 163
        },
        { 
          id: 2, 
          slug: 'murphys-love-laws', 
          title: "Murphy's Love Laws", 
          description: 'Romance rules: the heart wants what it cannot have.',
          law_count: 210
        },
        { 
          id: 3, 
          slug: 'murphys-alarm-clock-laws', 
          title: "Murphy's Alarm Clock Laws", 
          description: null,
          law_count: 5
        }
      ]
    });
  });

  it('renders initial structure with loading state', () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    expect(el.querySelector('#categories-grid')).toBeTruthy();
    expect(el.innerHTML).toContain('Loading...');
    expect(el.className).toBe('container page');
  });

  it('fetches and displays categories', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(api.fetchCategories).toHaveBeenCalled();
    expect(el.textContent).toContain("Murphy's Alarm Clock Laws");
    expect(el.textContent).toContain("Murphy's Computer Laws");
    expect(el.textContent).toContain("Murphy's Love Laws");
  });

  it('displays category descriptions', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Digital doom: programs are obsolete when running.');
    expect(el.textContent).toContain('Romance rules: the heart wants what it cannot have.');
  });

  it('displays fallback description when none provided', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // The Alarm Clock Laws card should have the fallback description
    expect(el.textContent).toContain('Explore laws in this category.');
  });

  it('displays law counts', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('163 laws');
    expect(el.textContent).toContain('210 laws');
    expect(el.textContent).toContain('5 laws');
  });

  it('displays singular "law" for count of 1', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'single', title: 'Single Law Category', description: 'One law only.', law_count: 1 }
      ]
    });

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('1 law');
    expect(el.textContent).not.toContain('1 laws');
  });

  it('sorts categories alphabetically by title', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const cards = el.querySelectorAll('.category-card');
    expect(cards.length).toBe(3);
    
    // Should be alphabetically sorted: Alarm Clock, Computer, Love
    expect(cards[0].textContent).toContain("Murphy's Alarm Clock Laws");
    expect(cards[1].textContent).toContain("Murphy's Computer Laws");
    expect(cards[2].textContent).toContain("Murphy's Love Laws");
  });

  it('navigates to category on card click', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const card = el.querySelector('.category-card[data-category-slug="murphys-computer-laws"]');
    expect(card).toBeTruthy();
    
    card.click();
    expect(localThis.onNavigate).toHaveBeenCalledWith('category', 'murphys-computer-laws');
  });

  it('navigates to category on Enter key press', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const card = el.querySelector('.category-card[data-category-slug="murphys-love-laws"]');
    expect(card).toBeTruthy();
    
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    card.dispatchEvent(enterEvent);
    
    expect(localThis.onNavigate).toHaveBeenCalledWith('category', 'murphys-love-laws');
  });

  it('navigates to category on Space key press', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const card = el.querySelector('.category-card[data-category-slug="murphys-alarm-clock-laws"]');
    expect(card).toBeTruthy();
    
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    card.dispatchEvent(spaceEvent);
    
    expect(localThis.onNavigate).toHaveBeenCalledWith('category', 'murphys-alarm-clock-laws');
  });

  it('has accessible attributes on cards', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const card = el.querySelector('.category-card');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('link');
    expect(card.getAttribute('aria-label')).toContain('laws');
  });

  it('displays empty state when no categories', async () => {
    api.fetchCategories.mockResolvedValue({ data: [] });

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('No categories found');
  });

  it('displays error state on API failure', async () => {
    api.fetchCategories.mockRejectedValue(new Error('Network error'));

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Failed to load categories');
    expect(el.querySelector('#retry-categories')).toBeTruthy();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('retries loading on retry button click', async () => {
    api.fetchCategories.mockRejectedValueOnce(new Error('Network error'));
    
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('Failed to load categories');
    expect(api.fetchCategories).toHaveBeenCalledTimes(1);

    // Reset mock to succeed on retry
    api.fetchCategories.mockResolvedValue({
      data: [{ id: 1, slug: 'test', title: 'Test Category', description: 'Test', law_count: 10 }]
    });

    const retryBtn = el.querySelector('#retry-categories');
    retryBtn.click();
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(api.fetchCategories).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Test Category');
  });

  it('sets page title', async () => {
    Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(document.title).toContain('Browse Laws by Category');
  });

  it('renders page header and subtitle', () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    
    expect(el.textContent).toContain('Browse Laws by Category');
    expect(el.textContent).toContain('Explore Murphy\'s Laws organized by topic');
  });

  it('removes loading state after categories load', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    
    // Initially has loading class
    const grid = el.querySelector('#categories-grid');
    expect(grid.classList.contains('loading-placeholder')).toBe(true);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // After load, should not have loading class
    expect(grid.classList.contains('loading-placeholder')).toBe(false);
  });

  it('handles category with law_count of 0', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'empty-category', title: 'Empty Category', description: 'No laws here.', law_count: 0 }
      ]
    });

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(el.textContent).toContain('0 laws');
  });

  it('handles category with undefined law_count', async () => {
    api.fetchCategories.mockResolvedValue({
      data: [
        { id: 1, slug: 'no-count', title: 'No Count Category', description: 'Missing count.' }
      ]
    });

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should default to 0
    expect(el.textContent).toContain('0 laws');
  });

  it('handles response with undefined data', async () => {
    api.fetchCategories.mockResolvedValue({});

    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should show empty state
    expect(el.textContent).toContain('No categories found');
  });

  it('ignores click events from non-HTMLElement targets', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create a click event with a non-HTMLElement target (e.g., text node)
    const textNode = document.createTextNode('text');
    el.appendChild(textNode);
    
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: textNode });
    
    el.dispatchEvent(clickEvent);
    
    // onNavigate should not be called
    expect(localThis.onNavigate).not.toHaveBeenCalled();
  });

  it('ignores keydown events from non-HTMLElement targets', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    const textNode = document.createTextNode('text');
    el.appendChild(textNode);
    
    const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(keyEvent, 'target', { value: textNode });
    
    el.dispatchEvent(keyEvent);
    
    expect(localThis.onNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when clicking card without slug attribute', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Reset the mock to clear any calls from initial render
    localThis.onNavigate.mockClear();

    // Create a card manually without the data-category-slug attribute
    const manualCard = document.createElement('div');
    manualCard.className = 'category-card';
    // No data-category-slug attribute set at all
    el.appendChild(manualCard);

    manualCard.click();
    
    // onNavigate should not have been called since card has no slug
    expect(localThis.onNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate on keydown when card has no slug attribute', async () => {
    const el = Categories({ onNavigate: localThis.onNavigate });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Reset the mock to clear any calls from initial render
    localThis.onNavigate.mockClear();

    // Create a card manually without the data-category-slug attribute
    const manualCard = document.createElement('div');
    manualCard.className = 'category-card';
    // No data-category-slug attribute set at all
    el.appendChild(manualCard);

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    manualCard.dispatchEvent(enterEvent);
    
    // onNavigate should not have been called since card has no slug
    expect(localThis.onNavigate).not.toHaveBeenCalled();
  });
});
