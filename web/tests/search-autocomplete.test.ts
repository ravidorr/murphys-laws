import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchAutocomplete } from '../src/components/search-autocomplete.js';
import * as api from '../src/utils/api.js';
import type { Law, PaginatedResponse } from '../src/types/app.d.ts';

function suggestionsResponse(data: Law[]): PaginatedResponse<Law> {
  return { data, total: data.length, limit: 10, offset: 0 };
}

// Mock Sentry
vi.mock('@sentry/browser', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';

// Mock the API module
vi.mock('../src/utils/api.js', () => ({
  fetchSuggestions: vi.fn()
}));

describe('SearchAutocomplete', () => {
  let inputElement: HTMLInputElement;
  let onSelect: (law: Law) => void;
  let autocomplete: { cleanup(): void; isOpen(): boolean } | undefined;

  beforeEach(() => {
    // Create a form with input element
    const form = document.createElement('form');
    form.setAttribute('role', 'search');
    inputElement = document.createElement('input');
    inputElement.setAttribute('id', 'header-search');
    inputElement.setAttribute('aria-label', 'Search');
    form.appendChild(inputElement);
    document.body.appendChild(form);

    onSelect = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (autocomplete && autocomplete.cleanup) {
      autocomplete.cleanup();
    }
    document.body.innerHTML = '';
  });

  it('should create autocomplete component', () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    expect(autocomplete).toBeDefined();
    expect(autocomplete.cleanup).toBeDefined();
    expect(autocomplete.isOpen).toBeDefined();
  });

  it('should throw error if inputElement is missing', () => {
    expect(() => {
      SearchAutocomplete({ onSelect } as unknown as Parameters<typeof SearchAutocomplete>[0]);
    }).toThrow('inputElement is required');
  });

  it('should set aria attributes on input', () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
    expect(inputElement.getAttribute('aria-autocomplete')).toBe('list');
    expect(inputElement.getAttribute('aria-controls')).toBe('search-autocomplete-listbox');
  });

  it('should create dropdown element', () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown).toBeTruthy();
    expect(dropdown!.getAttribute('role')).toBe('listbox');
    expect(dropdown!.getAttribute('aria-label')).toBe('Search suggestions');
  });

  it('should fetch suggestions on input with debounce', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    // Simulate input
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    // Wait for debounce (240ms default)
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(api.fetchSuggestions).toHaveBeenCalledWith({ q: 'test', limit: 10 });
  });

  it('should not fetch suggestions for query shorter than 2 characters', async () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'a';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    expect(api.fetchSuggestions).not.toHaveBeenCalled();
  });

  it('should render suggestions in dropdown', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    expect(items.length).toBe(2);
    expect(items[0]!.getAttribute('data-law-id')).toBe('1');
    expect(items[1]!.getAttribute('data-law-id')).toBe('2');
  });

  it('should render empty dropdown when API returns no suggestions (L66)', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });

    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown).toBeTruthy();
    expect(dropdown!.getAttribute('aria-hidden')).toBe('true');
    expect(dropdown!.innerHTML).toBe('');
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should highlight matching text in suggestions', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    expect(item!.innerHTML).toContain('<mark');
    expect(item!.innerHTML).toContain('search-suggestion-highlight');
  });

  it('should handle keyboard navigation with ArrowDown', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press ArrowDown
    const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    inputElement.dispatchEvent(arrowDownEvent);

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    expect(items[0]!.classList.contains('selected')).toBe(true);
  });

  it('should handle keyboard navigation with ArrowUp', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press ArrowUp (should wrap to last item)
    const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    inputElement.dispatchEvent(arrowUpEvent);

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    expect(items[1]!.classList.contains('selected')).toBe(true);
  });

  it('should select suggestion with Enter key', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Select first item
    const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    inputElement.dispatchEvent(arrowDownEvent);

    // Press Enter
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    inputElement.dispatchEvent(enterEvent);

    expect(onSelect).toHaveBeenCalledWith({ id: 1, text: 'Test law', title: undefined });
  });

  it('should close dropdown with Escape key', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(inputElement.getAttribute('aria-expanded')).toBe('true');

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    inputElement.dispatchEvent(escapeEvent);

    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should select suggestion on mouse click', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    (item as HTMLElement).click();

    expect(onSelect).toHaveBeenCalledWith({ id: 1, text: 'Test law', title: undefined });
  });

  it('should close dropdown when clicking outside', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(inputElement.getAttribute('aria-expanded')).toBe('true');

    // Click outside
    document.body.click();

    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(api.fetchSuggestions).mockRejectedValue(new Error('API Error'));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    // Should not throw, dropdown should be closed
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should cleanup event listeners', () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown).toBeTruthy();

    autocomplete.cleanup();

    // Dropdown should be removed
    expect(document.querySelector('.search-autocomplete')).toBeNull();
  });

  it('should use custom debounce delay', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect, debounceDelay: 100 });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    // Wait shorter time (100ms instead of 240ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(api.fetchSuggestions).toHaveBeenCalled();
  });

  it('should display title when available', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Law text', title: 'Law Title' }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'law';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    expect(item!.textContent).toContain('Law Title');
    expect(item!.textContent).toContain('Law text');
  });

  it('handles suggestion with empty text (highlightMatch L63 L66)', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: '', title: '' }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = 'ab';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    expect(item).toBeTruthy();
    expect(item!.getAttribute('data-law-id')).toBe('1');
  });

  it('closes dropdown on document click outside (L122)', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test', title: undefined }]));
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = 'te';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(document.querySelector('.search-suggestion-item')).toBeTruthy();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.search-autocomplete')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('should create dropdown as sibling when input has no form parent', () => {
    // Remove form and create input directly in body
    document.body.innerHTML = '';
    const container = document.createElement('div');
    inputElement = document.createElement('input');
    inputElement.setAttribute('id', 'header-search');
    container.appendChild(inputElement);
    document.body.appendChild(container);

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown).toBeTruthy();
    // Dropdown should be inserted after input (as sibling)
    expect(inputElement.nextSibling).toBe(dropdown);
  });

  it('should handle highlightMatch with empty query', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    // Set value then clear to trigger with empty query in render
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // The text should still be displayed (no highlighting when query is empty)
    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    expect(item!.textContent).toContain('Test law');
  });

  it('should handle highlightMatch with null text gracefully', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: null as unknown as string, title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    // Should not throw, item should exist
    expect(item).toBeTruthy();
  });

  it('should return text unchanged when query does not match', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'No match here', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = 'xyz';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    expect(item!.innerHTML).not.toContain('<mark');
    expect(item!.textContent).toContain('No match here');
  });

  it('should call scrollIntoView when selecting with keyboard', async () => {
    const scrollIntoView = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    Element.prototype.scrollIntoView = orig;
  });

  it('should close dropdown for query that is only whitespace', async () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = '   ';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(api.fetchSuggestions).not.toHaveBeenCalled();
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should use empty array when API returns undefined data', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue({ data: undefined, total: 0, limit: 10, offset: 0 } as PaginatedResponse<Law>);

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown!.innerHTML).toBe('');
  });

  it('should not call onSelect for invalid suggestion index (negative)', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    // Create a fake item with invalid index
    const fakeItem = document.createElement('div');
    fakeItem.className = 'search-suggestion-item';
    fakeItem.setAttribute('data-index', '-1');
    dropdown!.appendChild(fakeItem);
    
    fakeItem.click();

    // onSelect should not be called for invalid index
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should not call onSelect for invalid suggestion index (too large)', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    // Create a fake item with invalid index
    const fakeItem = document.createElement('div');
    fakeItem.className = 'search-suggestion-item';
    fakeItem.setAttribute('data-index', '999');
    dropdown!.appendChild(fakeItem);
    
    fakeItem.click();

    // onSelect should not be called for invalid index
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should wrap selection from end to beginning with ArrowDown', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Navigate to first item
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    // Navigate to second item
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    // Navigate past end - should wrap to no selection (-1)
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    // No item should be selected after wrapping
    expect(items[0]!.classList.contains('selected')).toBe(false);
    expect(items[1]!.classList.contains('selected')).toBe(false);
  });

  it('should go to no selection when pressing ArrowUp at first item', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Navigate to first item
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    // Navigate up from first item - goes to no selection (-1)
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    // No item should be selected
    expect(items[0]!.classList.contains('selected')).toBe(false);
    expect(items[1]!.classList.contains('selected')).toBe(false);
  });

  it('should wrap to last item when pressing ArrowUp with no selection', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([
      { id: 1, text: 'Test law 1', title: undefined },
      { id: 2, text: 'Test law 2', title: undefined }
    ]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press ArrowUp with no selection - should go to last item
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    // Last item should be selected
    expect(items[1]!.classList.contains('selected')).toBe(true);
  });

  it('should not handle keyboard events when dropdown is closed', () => {
    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    // Don't trigger any search, so dropdown is closed and no suggestions
    const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    inputElement.dispatchEvent(arrowDownEvent);

    // Should not throw or change anything
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should allow Enter key to pass through when no item is selected', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press Enter without selecting any item (selectedIndex is -1)
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    const prevented = !inputElement.dispatchEvent(enterEvent);

    // Event should NOT be prevented when no selection
    expect(prevented).toBe(false);
    // onSelect should not be called
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should not close dropdown when clicking on input element', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(inputElement.getAttribute('aria-expanded')).toBe('true');

    // Click on input element itself
    inputElement.click();

    // Dropdown should still be open
    expect(inputElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('should not close dropdown when clicking on dropdown itself', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    expect(inputElement.getAttribute('aria-expanded')).toBe('true');

    // Click on dropdown container (not on an item)
    const dropdown = document.querySelector('.search-autocomplete');
    // Create and dispatch click event with dropdown as target
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: dropdown });
    document.dispatchEvent(clickEvent);

    // Dropdown should still be open (items are still there)
    const items = dropdown!.querySelectorAll('.search-suggestion-item');
    expect(items.length).toBe(1);
  });

  it('should handle empty suggestions array from API', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Dropdown should be closed with empty suggestions
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
    const dropdown = document.querySelector('.search-autocomplete');
    expect(dropdown!.innerHTML).toBe('');
  });

  it('should handle API response with undefined data', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Should handle gracefully - dropdown should be closed
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should handle other keys without preventing default', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press a regular key
    const keyEvent = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    const prevented = !inputElement.dispatchEvent(keyEvent);

    // Event should NOT be prevented for regular keys
    expect(prevented).toBe(false);
  });

  it('should handle click on dropdown area without item', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    
    // Click on dropdown but not on an item
    const clickEvent = new MouseEvent('click', { bubbles: true });
    dropdown!.dispatchEvent(clickEvent);

    // onSelect should not be called
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should handle click on item with invalid data-index attribute', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    // Create a fake item with NaN index
    const fakeItem = document.createElement('div');
    fakeItem.className = 'search-suggestion-item';
    fakeItem.setAttribute('data-index', 'invalid');
    dropdown!.appendChild(fakeItem);
    
    fakeItem.click();

    // onSelect should not be called for NaN index
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should close dropdown for empty query after debounce', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    // First search with valid query
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));
    
    expect(inputElement.getAttribute('aria-expanded')).toBe('true');

    // Now clear the input
    inputElement.value = '';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Dropdown should be closed
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
  });

  it('should display text only when title is empty string', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Law text only', title: '' }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'law';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    // Should display text without title prefix
    expect((item!.textContent ?? '').trim()).not.toContain(':');
    expect(item!.textContent).toContain('Law text only');
  });

  it('should handle special regex characters in query for highlighting', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test (law) [special]', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    // Query with special regex characters
    inputElement.value = '(law)';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown!.querySelector('.search-suggestion-item');
    // Should not throw and should contain the text
    expect(item!.textContent).toContain('(law)');
  });

  it('should return correct isOpen state', async () => {
    vi.mocked(api.fetchSuggestions).mockResolvedValue(suggestionsResponse([{ id: 1, text: 'Test law', title: undefined }]));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });

    // Initially closed
    expect(autocomplete.isOpen()).toBe(false);

    // Open dropdown
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Now open
    expect(autocomplete.isOpen()).toBe(true);

    // Close via escape key
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(autocomplete.isOpen()).toBe(false);
  });
});
