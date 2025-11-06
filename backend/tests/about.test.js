import { About } from '../src/views/about.js';

describe('About page', () => {
  it('renders about page element', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
    expect(el.getAttribute('role')).toBe('main');
  });

  it('shows page title', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/About Murphy's Law Archive/);
  });

  it('displays Murphy\'s Law quote', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Anything that can go wrong, will/);
    expect(el.textContent).toMatch(/Capt. Edward A. Murphy Jr./);
  });

  it('contains What You\'ll Find section', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/What You'll Find/);
    expect(el.textContent).toMatch(/Curated Laws/);
    expect(el.textContent).toMatch(/Community Wisdom/);
    expect(el.textContent).toMatch(/Interactive Tools/);
    expect(el.textContent).toMatch(/Deep Dives/);
  });

  it('displays founder information', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Raanan Avidor/);
    expect(el.textContent).toMatch(/How It Happened/);
  });

  it('shows Why It Matters section', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Why It Matters/);
    expect(el.textContent).toMatch(/Stress relief/);
    expect(el.textContent).toMatch(/Preparedness/);
    expect(el.textContent).toMatch(/Shared experience/);
  });

  it('has navigation link to contact page', () => {
    const el = About({
      onNavigate: () => {}
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    expect(contactLink).toBeTruthy();
  });

  it('has navigation link to browse page', () => {
    const el = About({
      onNavigate: () => {}
    });

    const browseLink = el.querySelector('[data-nav="browse"]');
    expect(browseLink).toBeTruthy();
  });

  it('triggers onNavigate when clicking contact link', () => {
    let navigated = '';
    const el = About({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    contactLink.click();
    expect(navigated).toBe('contact');
  });

  it('triggers onNavigate when clicking browse link', () => {
    let navigated = '';
    const el = About({
      onNavigate: (page) => { navigated = page; }
    });

    const browseLink = el.querySelector('[data-nav="browse"]');
    browseLink.click();
    expect(navigated).toBe('browse');
  });

  it('has CC0 license link', () => {
    const el = About({
      onNavigate: () => {}
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink.getAttribute('target')).toBe('_blank');
    expect(ccLink.getAttribute('rel')).toBe('noopener');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = About({
      onNavigate: () => {}
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = { called: false };

    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultSpy.called = true; }
    });

    contactLink.dispatchEvent(event);
    expect(preventDefaultSpy.called).toBe(true);
  });

  it('does not trigger onNavigate for non-nav elements', () => {
    let navigated = '';
    const el = About({
      onNavigate: (page) => { navigated = page; }
    });

    const article = el.querySelector('article');
    article.click();
    expect(navigated).toBe('');
  });

  it('has proper semantic structure', () => {
    const el = About({
      onNavigate: () => {}
    });

    expect(el.querySelector('article')).toBeTruthy();
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelectorAll('section').length).toBeGreaterThan(0);
  });

  it('contains blockquote for Murphy\'s Law', () => {
    const el = About({
      onNavigate: () => {}
    });

    const blockquote = el.querySelector('blockquote');
    expect(blockquote).toBeTruthy();
    expect(blockquote.textContent).toMatch(/Anything that can go wrong/);
  });

});
