import { Terms } from '../src/views/terms.js';

describe('Terms page', () => {
  it('renders terms page element', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
  });

  it('shows page title', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Terms of Service/);
  });

  it('displays last updated date', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Last updated:/);
    expect(el.textContent).toMatch(/2025-10-18/);
  });

  it('shows Acceptance of Terms section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Acceptance of Terms/);
    expect(el.textContent).toMatch(/murphys-laws.com/);
  });

  it('contains What the Archive Provides section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/What the Archive Provides/);
    expect(el.textContent).toMatch(/Discover & Learn/);
    expect(el.textContent).toMatch(/Participate/);
  });

  it('shows Guidelines for Community Conduct', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Guidelines for Community Conduct/);
    expect(el.textContent).toMatch(/respectful/);
  });

  it('contains Content You Submit section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Content You Submit/);
    expect(el.textContent).toMatch(/royalty-free license/);
  });

  it('shows Intellectual Property section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Intellectual Property/);
    expect(el.textContent).toMatch(/CC0 1.0 Universal/);
  });

  it('has CC0 license link', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink.getAttribute('target')).toBe('_blank');
    expect(ccLink.getAttribute('rel')).toBe('noopener');
  });

  it('contains Advertising & External Links section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Advertising & External Links/);
  });

  it('shows Warranty Disclaimer', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Warranty Disclaimer/);
    expect(el.textContent).toMatch(/as-is/);
  });

  it('contains Limitation of Liability section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Limitation of Liability/);
  });

  it('shows Indemnity section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Indemnity/);
  });

  it('contains Third-Party Links section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Third-Party Links/);
  });

  it('shows Privacy section with link', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Privacy/);
    const privacyLink = el.querySelector('[data-nav="privacy"]');
    expect(privacyLink).toBeTruthy();
  });

  it('contains Changes to These Terms section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Changes to These Terms/);
  });

  it('shows Governing Law section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Governing Law/);
  });

  it('contains Ending Access section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Ending Access/);
  });

  it('has Contact Us section', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Contact Us/);
    const contactLink = el.querySelector('[data-nav="contact"]');
    expect(contactLink).toBeTruthy();
  });

  it('triggers onNavigate when clicking privacy link', () => {
    let navigated = '';
    const el = Terms({
      onNavigate: (page) => { navigated = page; }
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]');
    expect(privacyLink).toBeTruthy();
    (privacyLink as HTMLElement).click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate when clicking contact link', () => {
    let navigated = '';
    const el = Terms({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    expect(contactLink).toBeTruthy();
    (contactLink as HTMLElement).click();
    expect(navigated).toBe('contact');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Terms({
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
    const el = Terms({
      onNavigate: (page) => { navigated = page; }
    });

    const article = el.querySelector('article');
    article.click();
    expect(navigated).toBe('');
  });

  it('has proper semantic structure', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.querySelector('article')).toBeTruthy();
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelectorAll('section').length).toBeGreaterThan(10);
  });

  it('does not trigger onNavigate when clicking non-Element target', () => {
    let navigated = '';
    const el = Terms({
      onNavigate: (page) => { navigated = page; }
    });

    // Create a mock event with a non-Element target
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', {
      value: { notAnElement: true },
      writable: true
    });

    el.dispatchEvent(event);
    expect(navigated).toBe('');
  });

  it('does not trigger onNavigate when navTarget is empty', () => {
    let navigated = '';
    const el = Terms({
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
