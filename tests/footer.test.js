import { Footer } from '../src/components/footer.js';

describe('Footer component', () => {
  beforeEach(() => {
    // Reset adsbygoogle array
    window.adsbygoogle = [];
  });

  it('renders footer element', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    expect(el.tagName).toBe('FOOTER');
    expect(el.className).toBe('footer');
  });

  it('shows navigation links', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    expect(el.querySelector('[data-nav="about"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="privacy"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="terms"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="contact"]')).toBeTruthy();
  });

  it('triggers onNavigate when clicking nav link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const aboutLink = el.querySelector('[data-nav="about"]');
    aboutLink.click();
    expect(navigated).toBe('about');
  });

  it('triggers onNavigate for privacy link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const privacyLink = el.querySelector('[data-nav="privacy"]');
    privacyLink.click();
    expect(navigated).toBe('privacy');
  });

  it('triggers onNavigate for terms link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const termsLink = el.querySelector('[data-nav="terms"]');
    termsLink.click();
    expect(navigated).toBe('terms');
  });

  it('triggers onNavigate for contact link', () => {
    let navigated = '';
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const contactLink = el.querySelector('[data-nav="contact"]');
    contactLink.click();
    expect(navigated).toBe('contact');
  });

  it('contains AdSense ad element', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    const adsenseEl = el.querySelector('.adsbygoogle');
    expect(adsenseEl).toBeTruthy();
    expect(adsenseEl.getAttribute('data-ad-client')).toBe('ca-pub-3615614508734124');
  });

  it('initializes AdSense', () => {
    Footer({
      onNavigate: () => {}
    });

    expect(window.adsbygoogle.length).toBe(1);
  });

  it('handles AdSense errors gracefully', () => {
    window.adsbygoogle = {
      push: () => {
        throw new Error('AdSense error');
      }
    };

    expect(() => {
      Footer({ onNavigate: () => {} });
    }).not.toThrow();
  });

  it('shows CC0 license information', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    expect(el.textContent).toMatch(/CC0 1.0 Universal/);
  });

  it('has external link to Creative Commons', () => {
    const el = Footer({
      onNavigate: () => {}
    });

    const ccLink = el.querySelector('a[href*="creativecommons.org"]');
    expect(ccLink).toBeTruthy();
    expect(ccLink.getAttribute('target')).toBe('_blank');
    expect(ccLink.getAttribute('rel')).toBe('noopener');
  });

  it('prevents default behavior when clicking nav links', () => {
    const el = Footer({
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
    const el = Footer({
      onNavigate: (page) => { navigated = page; }
    });

    const container = el.querySelector('.container');
    container.click();
    expect(navigated).toBe('');
  });
});
