import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchAutocomplete } from '../src/components/search-autocomplete.js';
import * as api from '../src/utils/api.js';

// Mock the API module
vi.mock('../src/utils/api.js', () => ({
  fetchSuggestions: vi.fn()
}));

describe('SearchAutocomplete', () => {
  let inputElement;
  let onSelect;
  let autocomplete;

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
      SearchAutocomplete({ onSelect });
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
    expect(dropdown.getAttribute('role')).toBe('listbox');
    expect(dropdown.getAttribute('aria-label')).toBe('Search suggestions');
  });

  it('should fetch suggestions on input with debounce', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [
        { id: 1, text: 'Test law 1', title: null },
        { id: 2, text: 'Test law 2', title: null }
      ]
    });

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
    api.fetchSuggestions.mockResolvedValue({
      data: [
        { id: 1, text: 'Test law 1', title: null },
        { id: 2, text: 'Test law 2', title: null }
      ]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown.querySelectorAll('.search-suggestion-item');
    expect(items.length).toBe(2);
    expect(items[0].getAttribute('data-law-id')).toBe('1');
    expect(items[1].getAttribute('data-law-id')).toBe('2');
  });

  it('should highlight matching text in suggestions', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Test law', title: null }]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown.querySelector('.search-suggestion-item');
    expect(item.innerHTML).toContain('<mark');
    expect(item.innerHTML).toContain('search-suggestion-highlight');
  });

  it('should handle keyboard navigation with ArrowDown', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [
        { id: 1, text: 'Test law 1', title: null },
        { id: 2, text: 'Test law 2', title: null }
      ]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press ArrowDown
    const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    inputElement.dispatchEvent(arrowDownEvent);

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown.querySelectorAll('.search-suggestion-item');
    expect(items[0].classList.contains('selected')).toBe(true);
  });

  it('should handle keyboard navigation with ArrowUp', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [
        { id: 1, text: 'Test law 1', title: null },
        { id: 2, text: 'Test law 2', title: null }
      ]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    // Press ArrowUp (should wrap to last item)
    const arrowUpEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    inputElement.dispatchEvent(arrowUpEvent);

    const dropdown = document.querySelector('.search-autocomplete');
    const items = dropdown.querySelectorAll('.search-suggestion-item');
    expect(items[1].classList.contains('selected')).toBe(true);
  });

  it('should select suggestion with Enter key', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Test law', title: null }]
    });

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

    expect(onSelect).toHaveBeenCalledWith({ id: 1, text: 'Test law', title: null });
  });

  it('should close dropdown with Escape key', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Test law', title: null }]
    });

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
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Test law', title: null }]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown.querySelector('.search-suggestion-item');
    item.click();

    expect(onSelect).toHaveBeenCalledWith({ id: 1, text: 'Test law', title: null });
  });

  it('should close dropdown when clicking outside', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Test law', title: null }]
    });

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
    api.fetchSuggestions.mockRejectedValue(new Error('API Error'));

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    await new Promise(resolve => setTimeout(resolve, 250));

    // Should not throw, dropdown should be closed
    expect(inputElement.getAttribute('aria-expanded')).toBe('false');
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
    api.fetchSuggestions.mockResolvedValue({ data: [] });

    autocomplete = SearchAutocomplete({ inputElement, onSelect, debounceDelay: 100 });
    
    inputElement.value = 'test';
    inputElement.dispatchEvent(new Event('input'));

    // Wait shorter time (100ms instead of 240ms)
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(api.fetchSuggestions).toHaveBeenCalled();
  });

  it('should display title when available', async () => {
    api.fetchSuggestions.mockResolvedValue({
      data: [{ id: 1, text: 'Law text', title: 'Law Title' }]
    });

    autocomplete = SearchAutocomplete({ inputElement, onSelect });
    
    inputElement.value = 'law';
    inputElement.dispatchEvent(new Event('input'));
    await new Promise(resolve => setTimeout(resolve, 250));

    const dropdown = document.querySelector('.search-autocomplete');
    const item = dropdown.querySelector('.search-suggestion-item');
    expect(item.textContent).toContain('Law Title');
    expect(item.textContent).toContain('Law text');
  });
});
