import { describe, it, expect, vi, afterEach } from 'vitest';
import { NotFound } from '../src/views/not-found.js';

describe('NotFound view', () => {
  let el: HTMLElement | null;

  afterEach(() => {
    if (el?.parentNode) {
      el.parentNode.removeChild(el);
    }
    el = null;
    sessionStorage.clear();
  });

  it('renders heading and message', () => {
    el = NotFound({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Page Not Found/i);
    expect(el.textContent).toMatch(/could not be found/i);
  });

  it('renders Murphy quote', () => {
    el = NotFound({ onNavigate: () => {} });

    expect(el.querySelector('.not-found-quote')).toBeTruthy();
    expect(el.textContent).toMatch(/Murphy/i);
  });

  it('ignores click when target is not HTMLElement', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: document.createTextNode('x'), writable: false });
    el.dispatchEvent(event);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates back home when button is clicked', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    const btn = el.querySelector('[data-nav="home"]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('home', undefined);
  });

  it('navigates to browse when Browse All Laws button is clicked', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    const btn = el.querySelector('[data-nav="browse"]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('browse', undefined);
  });

  it('navigates to category with param when category button is clicked', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    const categoryBtn = el.querySelector('[data-nav="category"]');
    categoryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('category', expect.any(String));
  });

  it('click on element with data-nav calls onNavigate with navTarget (L30)', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    const homeBtn = el.querySelector('[data-nav="home"]') as HTMLElement;
    expect(homeBtn).toBeTruthy();
    homeBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('home', undefined);
  });

  it('has search form', () => {
    el = NotFound({ onNavigate: () => {} });

    const searchForm = el.querySelector('#not-found-search-form');
    const searchInput = el.querySelector('#not-found-search-input');

    expect(searchForm).toBeTruthy();
    expect(searchInput).toBeTruthy();
  });

  it('stores search query in sessionStorage and navigates to browse on search', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    expect(el).toBeTruthy();
    const searchForm = el.querySelector('#not-found-search-form');
    const searchInput = el.querySelector('#not-found-search-input');
    expect(searchForm).toBeTruthy();
    expect(searchInput).toBeTruthy();
    (searchInput as HTMLInputElement).value = 'test query';
    (searchForm as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true }));

    expect(sessionStorage.getItem('searchQuery')).toBe('test query');
    expect(onNavigate).toHaveBeenCalledWith('browse');
  });

  it('does not navigate on empty search query', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    expect(el).toBeTruthy();
    const searchForm = el.querySelector('#not-found-search-form');
    const searchInput = el.querySelector('#not-found-search-input');
    expect(searchForm).toBeTruthy();
    expect(searchInput).toBeTruthy();
    (searchInput as HTMLInputElement).value = '   ';
    (searchForm as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true }));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not trigger onNavigate when clicking non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    // Create a mock event with a non-HTMLElement target
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', {
      value: { notAnHTMLElement: true },
      writable: true
    });

    el.dispatchEvent(event);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not trigger onNavigate when navTarget is empty', () => {
    const onNavigate = vi.fn();
    el = NotFound({ onNavigate });

    // Create a nav button with empty data-nav attribute
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', '');
    el.appendChild(navBtn);

    navBtn.click();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('renders popular category links', () => {
    el = NotFound({ onNavigate: () => {} });

    const categoryLinks = el.querySelectorAll('.not-found-category-links button');
    expect(categoryLinks.length).toBeGreaterThan(0);
  });
});
