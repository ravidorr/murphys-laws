import { SocialShare } from '../src/components/social-share.js';
import * as icons from '../src/utils/icons.js';

describe('SocialShare component', () => {
  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = { href: 'https://test.com/page' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates social share buttons container', () => {
    const el = SocialShare();
    expect(el.className).toBe('share-buttons');
    expect(el.children.length).toBe(7); // Twitter, Facebook, LinkedIn, Reddit, Email, Copy Text, Copy Link
  });

  it('uses default values when no options provided', () => {
    document.title = 'Test Page Title';
    const el = SocialShare();

    const twitterLink = el.querySelector('.share-twitter');
    expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/page'));
    expect(twitterLink.href).toContain(encodeURIComponent('Test Page Title'));
  });

  it('uses provided url instead of window.location.href', () => {
    const el = SocialShare({ url: 'https://custom.com/law/123' });

    const twitterLink = el.querySelector('.share-twitter');
    expect(twitterLink.href).toContain(encodeURIComponent('https://custom.com/law/123'));
  });

  it('uses provided title instead of document.title', () => {
    const el = SocialShare({ title: 'Custom Law Title' });

    const twitterLink = el.querySelector('.share-twitter');
    expect(twitterLink.href).toContain(encodeURIComponent('Custom Law Title'));
  });

  it('uses provided description', () => {
    const el = SocialShare({
      url: 'https://test.com',
      title: 'Test',
      description: 'Custom description here'
    });

    const linkedinLink = el.querySelector('.share-linkedin');
    expect(linkedinLink.href).toContain(encodeURIComponent('Custom description here'));
  });

  describe('Twitter button', () => {
    it('creates Twitter share button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const button = el.querySelector('.share-twitter');

      expect(button.className).toBe('share-button share-twitter');
      expect(button.getAttribute('aria-label')).toBe('Share on X');
      expect(button.getAttribute('title')).toBe('Share on X');
      expect(button.getAttribute('rel')).toBe('noopener noreferrer');
      expect(button.getAttribute('target')).toBe('_blank');
      expect(button.href).toContain('twitter.com/intent/tweet');
    });
  });

  describe('Facebook button', () => {
    it('creates Facebook share button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const button = el.querySelector('.share-facebook');

      expect(button.className).toBe('share-button share-facebook');
      expect(button.getAttribute('aria-label')).toBe('Share on Facebook');
      expect(button.getAttribute('title')).toBe('Share on Facebook');
      expect(button.getAttribute('rel')).toBe('noopener noreferrer');
      expect(button.getAttribute('target')).toBe('_blank');
      expect(button.href).toContain('facebook.com/sharer');
    });
  });

  describe('LinkedIn button', () => {
    it('creates LinkedIn share button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const button = el.querySelector('.share-linkedin');

      expect(button.className).toBe('share-button share-linkedin');
      expect(button.getAttribute('aria-label')).toBe('Share on LinkedIn');
      expect(button.getAttribute('title')).toBe('Share on LinkedIn');
      expect(button.getAttribute('rel')).toBe('noopener noreferrer');
      expect(button.getAttribute('target')).toBe('_blank');
      expect(button.href).toContain('linkedin.com/shareArticle');
    });

    it('includes description in LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test Law',
        description: 'This is a detailed description'
      });
      const button = el.querySelector('.share-linkedin');

      expect(button.href).toContain('summary=');
      expect(button.href).toContain(encodeURIComponent('This is a detailed description'));
    });
  });

  describe('Reddit button', () => {
    it('creates Reddit share button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const button = el.querySelector('.share-reddit');

      expect(button.className).toBe('share-button share-reddit');
      expect(button.getAttribute('aria-label')).toBe('Share on Reddit');
      expect(button.getAttribute('title')).toBe('Share on Reddit');
      expect(button.getAttribute('rel')).toBe('noopener noreferrer');
      expect(button.getAttribute('target')).toBe('_blank');
      expect(button.href).toContain('reddit.com/submit');
    });
  });

  describe('Email button', () => {
    it('creates Email share button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const button = el.querySelector('.share-email');

      expect(button.className).toBe('share-button share-email');
      expect(button.getAttribute('aria-label')).toBe('Share via Email');
      expect(button.getAttribute('title')).toBe('Share via Email');
      expect(button.hasAttribute('rel')).toBe(false);
      expect(button.hasAttribute('target')).toBe(false);
      expect(button.href).toContain('mailto:');
    });

    it('includes custom subject and body in email', () => {
      const el = SocialShare({
        url: 'https://test.com/law/123',
        title: 'Murphy\'s Original Law'
      });
      const button = el.querySelector('.share-email');

      expect(button.href).toContain('subject=');
      expect(button.href).toContain(encodeURIComponent('Check out this Murphy\'s Law'));
      expect(button.href).toContain('body=');
      expect(button.href).toContain(encodeURIComponent('Murphy\'s Original Law'));
      expect(button.href).toContain(encodeURIComponent('https://test.com/law/123'));
    });
  });

  describe('Icons', () => {
    it('includes icons for each platform', () => {
      const el = SocialShare();

      const icons = el.querySelectorAll('svg');
      expect(icons.length).toBe(7); // 5 social + 2 copy buttons
    });

    it('handles missing icon gracefully', () => {
      // Mock createIcon to return null for one icon
      const createIconSpy = vi.spyOn(icons, 'createIcon');
      createIconSpy.mockImplementation((name) => {
        if (name === 'twitter') return null;
        return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      });

      const el = SocialShare();
      const twitterButton = el.querySelector('.share-twitter');

      // Button should still exist, just without icon
      expect(twitterButton).toBeTruthy();
      expect(twitterButton.children.length).toBe(0);
    });

    it('adds share-icon class to all icons', () => {
      const createIconSpy = vi.spyOn(icons, 'createIcon');

      SocialShare();

      // Verify createIcon was called with correct classNames for all 7 buttons
      expect(createIconSpy).toHaveBeenCalledWith('twitter', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('facebook', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('linkedin', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('reddit', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('email', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('copy', { classNames: ['share-icon'] });
      expect(createIconSpy).toHaveBeenCalledWith('link', { classNames: ['share-icon'] });
    });
  });

  describe('Copy Text button', () => {
    it('creates Copy Text button with correct attributes', () => {
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      const button = el.querySelector('.share-copy-text');

      expect(button.className).toBe('share-button share-copy-text');
      expect(button.getAttribute('aria-label')).toBe('Copy text');
      expect(button.getAttribute('title')).toBe('Copy text');
      expect(button.getAttribute('data-action')).toBe('copy-text');
      expect(button.getAttribute('data-copy-value')).toBe('Test Law Text');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses title as fallback for lawText', () => {
      const el = SocialShare({ title: 'Title as fallback' });
      const button = el.querySelector('.share-copy-text');

      expect(button.getAttribute('data-copy-value')).toBe('Title as fallback');
    });
  });

  describe('Copy Link button', () => {
    it('creates Copy Link button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com/law/123', lawId: '123' });
      const button = el.querySelector('.share-copy-link');

      expect(button.className).toBe('share-button share-copy-link');
      expect(button.getAttribute('aria-label')).toBe('Copy link');
      expect(button.getAttribute('title')).toBe('Copy link');
      expect(button.getAttribute('data-action')).toBe('copy-link');
      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/law/123');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses window.location.href as fallback for url', () => {
      const el = SocialShare();
      const button = el.querySelector('.share-copy-link');

      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/page');
    });
  });

  describe('URL encoding', () => {
    it('properly encodes special characters in URL', () => {
      const el = SocialShare({
        url: 'https://test.com/law?id=123&sort=votes',
        title: 'Law with & and = chars'
      });

      const twitterButton = el.querySelector('.share-twitter');
      expect(twitterButton.href).toContain(encodeURIComponent('https://test.com/law?id=123&sort=votes'));
    });

    it('properly encodes special characters in title', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Murphy\'s Law: "Everything fails"'
      });

      const twitterButton = el.querySelector('.share-twitter');
      // Check that special characters are present (browser may encode ' as %27)
      expect(twitterButton.href).toContain('Murphy');
      expect(twitterButton.href).toContain('Law');
      expect(twitterButton.href).toContain('Everything');
      expect(twitterButton.href).toContain('fails');
    });

    it('handles empty description', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test',
        description: ''
      });

      const linkedinButton = el.querySelector('.share-linkedin');
      expect(linkedinButton.href).toContain('summary=');
    });
  });

  describe('Platform-specific URLs', () => {
    it('creates correct Twitter intent URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const button = el.querySelector('.share-twitter');
      expect(button.href).toContain('https://twitter.com/intent/tweet?url=');
      expect(button.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(button.href).toContain('&text=');
      expect(button.href).toContain('Murphy');
      expect(button.href).toContain('Law');
    });

    it('creates correct Facebook sharer URL', () => {
      const el = SocialShare({ url: 'https://murphys-laws.com/law/42' });

      const button = el.querySelector('.share-facebook');
      const expectedUrl = 'https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent('https://murphys-laws.com/law/42');

      expect(button.href).toBe(expectedUrl);
    });

    it('creates correct LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law',
        description: 'Anything that can go wrong'
      });

      const button = el.querySelector('.share-linkedin');
      expect(button.href).toContain('https://www.linkedin.com/shareArticle?mini=true');
      expect(button.href).toContain('url=' + encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(button.href).toContain('title=');
      expect(button.href).toContain('Murphy');
      expect(button.href).toContain('summary=' + encodeURIComponent('Anything that can go wrong'));
    });

    it('creates correct Reddit submit URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const button = el.querySelector('.share-reddit');
      expect(button.href).toContain('https://www.reddit.com/submit?url=');
      expect(button.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(button.href).toContain('&title=');
      expect(button.href).toContain('Murphy');
      expect(button.href).toContain('Law');
    });

    it('creates correct mailto URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const button = el.querySelector('.share-email');
      expect(button.href).toContain('mailto:?subject=');
      expect(button.href).toContain('&body=');
    });
  });
});
