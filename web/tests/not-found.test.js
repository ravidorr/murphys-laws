import { describe, it, expect, vi } from 'vitest';
import { NotFound } from '../src/views/not-found.js';

describe('NotFound view', () => {
  it('renders heading and message', () => {
    const el = NotFound({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Page Not Found/i);
    expect(el.textContent).toMatch(/could not be found/i);
  });

  it('navigates back home when button is clicked', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

    const btn = el.querySelector('[data-nav="home"]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('does not trigger onNavigate when clicking non-HTMLElement target', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

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
    const el = NotFound({ onNavigate });

    // Create a nav button with empty data-nav attribute
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', '');
    el.appendChild(navBtn);

    navBtn.click();
    expect(onNavigate).not.toHaveBeenCalled();
  });

});
