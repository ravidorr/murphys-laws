import { Privacy } from '../src/views/privacy.js';

describe('Privacy page', () => {
  it('renders privacy page element', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('content-page');
    expect(el.getAttribute('role')).toBe('main');
  });

  it('shows page title', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Privacy Policy/);
  });

  it('displays last updated date', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Last updated:/);
    expect(el.textContent).toMatch(/2025-11-06/);
  });

  it('shows What We Collect section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/What We Collect/);
    expect(el.textContent).toMatch(/Information You Share/);
    expect(el.textContent).toMatch(/Activity Signals/);
  });

  it('shows How We Use Data section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/How We Use Data/);
    expect(el.textContent).toMatch(/Operate the archive/);
    expect(el.textContent).toMatch(/Improve the experience/);
    expect(el.textContent).toMatch(/Keep things safe/);
  });

  it('contains Cookies & Analytics information', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Cookies & Analytics/);
    expect(el.textContent).toMatch(/first-party cookies/);
  });

  it('shows Third-Party Services section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Third-Party Services/);
    expect(el.textContent).toMatch(/email delivery/);
  });

  it('contains Data Retention information', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Data Retention/);
  });

  it('shows Your Choices section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Your Choices/);
    expect(el.textContent).toMatch(/Control submissions/);
    expect(el.textContent).toMatch(/Access information/);
    expect(el.textContent).toMatch(/Opt out/);
  });

  it('contains Security Practices information', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Security Practices/);
    expect(el.textContent).toMatch(/encryption/);
  });

  it('shows Global Visitors section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Global Visitors/);
    expect(el.textContent).toMatch(/United States/);
  });

  it('has navigation link to contact page', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    expect(contactLink).toBeTruthy();
  });

  it('triggers onNavigate when clicking contact link', () => {
    let navigated = '';
    const el = Privacy({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    contactLink.click();
    expect(navigated).toBe('contact');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Privacy({
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
    const el = Privacy({
      onNavigate: (page) => { navigated = page; }
    });

    const article = el.querySelector('article');
    article.click();
    expect(navigated).toBe('');
  });

  it('has proper semantic structure', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.querySelector('article')).toBeTruthy();
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelectorAll('section').length).toBeGreaterThan(0);
  });

  it('contains Updates section', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Updates/);
  });

  it('has Contact section at the end', () => {
    const el = Privacy({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Contact/);
    expect(el.textContent).toMatch(/Send us a note/);
  });

  it('does not navigate when navTarget is missing', () => {
    const onNavigate = vi.fn();
    const el = Privacy({ onNavigate });

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
    const el = Privacy({ onNavigate });

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
    const el = Privacy({ onNavigate });

    // Find any nav link in privacy page
    const navLink = el.querySelector('[data-nav]');
    if (navLink) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      let preventDefaultCalled = false;
      
      Object.defineProperty(event, 'preventDefault', {
        value: () => { preventDefaultCalled = true; },
        writable: true,
        configurable: true
      });

      navLink.dispatchEvent(event);

      expect(preventDefaultCalled).toBe(true);
    }
  });

  it('does not process click when target is not HTMLElement', () => {
    const onNavigate = vi.fn();
    const el = Privacy({ onNavigate });

    // Create a text node (not an HTMLElement)
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

    // Should not call onNavigate when target is not HTMLElement
    expect(onNavigate).not.toHaveBeenCalled();
  });

});
