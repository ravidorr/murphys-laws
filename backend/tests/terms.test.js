import { Terms } from '../src/views/terms.js';

describe('Terms page', () => {
  it('renders terms page element', () => {
    const el = Terms({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
    expect(el.getAttribute('role')).toBe('main');
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
    privacyLink.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate when clicking contact link', () => {
    let navigated = '';
    const el = Terms({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    contactLink.click();
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

  it('does not navigate when navTarget is missing', () => {
    const onNavigate = vi.fn();
    const el = Terms({ onNavigate });

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
    const el = Terms({ onNavigate });

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
    const el = Terms({ onNavigate });

    const contactLink = el.querySelector('[data-nav="contact"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    let preventDefaultCalled = false;
    
    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultCalled = true; },
      writable: true,
      configurable: true
    });

    contactLink.dispatchEvent(event);

    expect(preventDefaultCalled).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('contact');
  });

  it('does not process click when target is not Element', () => {
    const onNavigate = vi.fn();
    const el = Terms({ onNavigate });

    // Create a text node (not an Element)
    const textNode = document.createTextNode('Some text');
    el.appendChild(textNode);

    // Create a click event with text node as target
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    
    // Manually set target to text node (simulating what happens in real DOM)
    Object.defineProperty(event, 'target', {
      value: textNode,
      writable: true,
      configurable: true
    });

    el.dispatchEvent(event);

    // Should not call onNavigate when target is not Element
    expect(onNavigate).not.toHaveBeenCalled();
  });

});
