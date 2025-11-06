import { Contact } from '../src/views/contact.js';

describe('Contact page', () => {
  it('renders contact page element', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
    expect(el.getAttribute('role')).toBe('main');
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
    expect(el.textContent).toMatch(/two business days/);
  });

  it('triggers onNavigate when clicking submit link', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const submitLink = el.querySelector('[data-nav="submit"]');
    submitLink.click();
    expect(navigated).toBe('submit');
  });

  it('does not trigger onNavigate for non-nav elements', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const article = el.querySelector('article');
    article.click();
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

  it('does not navigate when navTarget is missing', () => {
    const onNavigate = vi.fn();
    const el = Contact({ onNavigate });

    // Create a nav button without data-nav attribute
    const fakeNavBtn = document.createElement('button');
    fakeNavBtn.setAttribute('data-nav', ''); // Empty nav target
    el.appendChild(fakeNavBtn);

    fakeNavBtn.click();

    // Should not call onNavigate when navTarget is empty
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate when clicking element without data-nav ancestor', () => {
    const onNavigate = vi.fn();
    const el = Contact({ onNavigate });

    // Create an element that doesn't have data-nav ancestor
    const regularDiv = document.createElement('div');
    regularDiv.textContent = 'Regular content';
    el.appendChild(regularDiv);

    regularDiv.click();

    // Should not call onNavigate when no navBtn found
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls preventDefault when clicking nav link', () => {
    const onNavigate = vi.fn();
    const el = Contact({ onNavigate });

    const submitLink = el.querySelector('[data-nav="submit"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    let preventDefaultCalled = false;
    
    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultCalled = true; },
      writable: true,
      configurable: true
    });

    submitLink.dispatchEvent(event);

    expect(preventDefaultCalled).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('submit');
  });

});
