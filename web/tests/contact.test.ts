import { describe, it, expect } from 'vitest';
import { Contact } from '../src/views/contact.js';

describe('Contact page', () => {
  it('renders contact page element', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
  });

  it('shows page title', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Contact Murphy's Law Archive/);
  });

  it('contains Send a Message section', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Send a Message/);
  });

  it('shows Share a Law option', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Share a Law/);
    const submitLink = el.querySelector('[data-nav="submit"]');
    expect(submitLink).toBeTruthy();
  });

  it('displays email address', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/contact@murphys-laws.com/);
    const emailLink = el.querySelector('a[href="mailto:contact@murphys-laws.com"]');
    expect(emailLink).toBeTruthy();
  });

  it('contains Need Support section', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Need Support/);
    expect(el.textContent).toMatch(/Spot a glitch/);
  });

  it('shows When You\'ll Hear Back section', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/When You'll Hear Back/);
    expect(el.textContent).toMatch(/within a day/);
  });

  it('triggers onNavigate when clicking submit link', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const submitLink = el.querySelector('[data-nav="submit"]');
    expect(submitLink).toBeTruthy();
    (submitLink as HTMLElement).click();
    expect(navigated).toBe('submit');
  });

  it('does not trigger onNavigate for non-nav elements', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const article = el.querySelector('article');
    expect(article).toBeTruthy();
    article!.click();
    expect(navigated).toBe('');
  });

  it('has proper semantic structure', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.querySelector('article')).toBeTruthy();
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelectorAll('section').length).toBeGreaterThan(0);
  });

  it('does not trigger onNavigate when clicking non-HTMLElement target', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    // Create a mock event with a non-HTMLElement target
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', {
      value: { notAnHTMLElement: true },
      writable: true
    });

    el.dispatchEvent(event);
    expect(navigated).toBe('');
  });

  it('does not trigger onNavigate when navTarget is empty', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    // Create a nav button with empty data-nav attribute
    const navBtn = document.createElement('button');
    navBtn.setAttribute('data-nav', '');
    el.appendChild(navBtn);

    navBtn.click();
    expect(navigated).toBe('');
  });

});
