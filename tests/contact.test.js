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

  it('contains Quick Links section', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/Quick Links/);
  });

  it('has navigation link to about page', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    expect(aboutLink).toBeTruthy();
  });

  it('has navigation link to privacy page', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]');
    expect(privacyLink).toBeTruthy();
  });

  it('has navigation link to terms page', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    const termsLink = el.querySelector('[data-nav="terms"]');
    expect(termsLink).toBeTruthy();
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

  it('triggers onNavigate when clicking about link', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    aboutLink.click();
    expect(navigated).toBe('about');
  });

  it('triggers onNavigate when clicking privacy link', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]');
    privacyLink.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate when clicking terms link', () => {
    let navigated = '';
    const el = Contact({
      onNavigate: (page) => { navigated = page; }
    });

    const termsLink = el.querySelector('[data-nav="terms"]');
    termsLink.click();
    expect(navigated).toBe('terms');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Contact({
      onNavigate: () => {}
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = { called: false };

    Object.defineProperty(event, 'preventDefault', {
      value: () => { preventDefaultSpy.called = true; }
    });

    aboutLink.dispatchEvent(event);
    expect(preventDefaultSpy.called).toBe(true);
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
});
