import { SocialShare, renderShareButtonsHTML, initSharePopovers } from '../src/components/social-share.js';
import * as icons from '../src/utils/icons.js';

describe('SocialShare component', () => {
  const localThis = {};

  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
    // Store spies for cleanup
    localThis.documentClickHandler = null;
    localThis.documentKeydownHandler = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates social share wrapper container', () => {
    const el = SocialShare();
    expect(el.className).toBe('share-wrapper');
  });

  it('creates a trigger button', () => {
    const el = SocialShare();
    const trigger = el.querySelector('.share-trigger');
    
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger.textContent).toContain('Share');
  });

  it('creates a popover with menu items', () => {
    const el = SocialShare();
    const popover = el.querySelector('.share-popover');
    
    expect(popover).toBeTruthy();
    expect(popover.getAttribute('role')).toBe('menu');
    
    // Should have 5 social links + 2 copy buttons = 7 items
    const items = popover.querySelectorAll('.share-popover-item');
    expect(items.length).toBe(7);
  });

  it('uses default values when no options provided', () => {
    document.title = 'Test Page Title';
    const el = SocialShare();

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/page'));
    expect(twitterLink.href).toContain(encodeURIComponent('Test Page Title'));
  });

  it('uses provided url instead of window.location.href', () => {
    const el = SocialShare({ url: 'https://custom.com/law/123' });

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('https://custom.com/law/123'));
  });

  it('uses provided title instead of document.title', () => {
    const el = SocialShare({ title: 'Custom Law Title' });

    const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
    expect(twitterLink.href).toContain(encodeURIComponent('Custom Law Title'));
  });

  it('uses provided description', () => {
    const el = SocialShare({
      url: 'https://test.com',
      title: 'Test',
      description: 'Custom description here'
    });

    const linkedinLink = el.querySelector('.share-popover-item[href*="linkedin"]');
    expect(linkedinLink.href).toContain(encodeURIComponent('Custom description here'));
  });

  describe('Twitter button', () => {
    it('creates Twitter share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="twitter"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('twitter.com/intent/tweet');
    });
  });

  describe('Facebook button', () => {
    it('creates Facebook share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="facebook"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('facebook.com/sharer');
    });
  });

  describe('LinkedIn button', () => {
    it('creates LinkedIn share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="linkedin"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('linkedin.com/shareArticle');
    });

    it('includes description in LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test Law',
        description: 'This is a detailed description'
      });
      const link = el.querySelector('.share-popover-item[href*="linkedin"]');

      expect(link.href).toContain('summary=');
      expect(link.href).toContain(encodeURIComponent('This is a detailed description'));
    });
  });

  describe('Reddit button', () => {
    it('creates Reddit share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="reddit"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.href).toContain('reddit.com/submit');
    });
  });

  describe('Email button', () => {
    it('creates Email share link with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com', title: 'Test Law' });
      const link = el.querySelector('.share-popover-item[href*="mailto"]');

      expect(link.getAttribute('role')).toBe('menuitem');
      expect(link.href).toContain('mailto:');
    });

    it('includes custom subject and body in email', () => {
      const el = SocialShare({
        url: 'https://test.com/law/123',
        title: 'Murphy\'s Original Law'
      });
      const link = el.querySelector('.share-popover-item[href*="mailto"]');

      expect(link.href).toContain('subject=');
      expect(link.href).toContain(encodeURIComponent('Check out this Murphy\'s Law'));
      expect(link.href).toContain('body=');
      expect(link.href).toContain(encodeURIComponent('Murphy\'s Original Law'));
      expect(link.href).toContain(encodeURIComponent('https://test.com/law/123'));
    });
  });

  describe('Icons', () => {
    it('includes share icon on trigger button', () => {
      const el = SocialShare();
      const trigger = el.querySelector('.share-trigger');
      const icon = trigger.querySelector('svg');
      
      expect(icon).toBeTruthy();
    });

    it('includes icon circles for each platform in popover', () => {
      const el = SocialShare();
      const iconCircles = el.querySelectorAll('.icon-circle');
      
      // 5 social platforms + 2 copy buttons = 7 icon circles
      expect(iconCircles.length).toBe(7);
    });

    it('handles missing icon gracefully', () => {
      // Mock createIcon to return null for one icon
      const createIconSpy = vi.spyOn(icons, 'createIcon');
      createIconSpy.mockImplementation((name) => {
        if (name === 'twitter') return null;
        return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      });

      const el = SocialShare();
      const twitterItem = el.querySelector('.icon-circle.twitter');

      // Icon circle should still exist, just without SVG inside
      expect(twitterItem).toBeTruthy();
      expect(twitterItem.querySelector('svg')).toBeFalsy();
    });
  });

  describe('Copy Text button', () => {
    it('creates Copy Text button with correct attributes', () => {
      const el = SocialShare({ lawText: 'Test Law Text', lawId: '123' });
      const button = el.querySelector('[data-action="copy-text"]');

      expect(button.getAttribute('role')).toBe('menuitem');
      expect(button.getAttribute('data-action')).toBe('copy-text');
      expect(button.getAttribute('data-copy-value')).toBe('Test Law Text');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses title as fallback for lawText', () => {
      const el = SocialShare({ title: 'Title as fallback' });
      const button = el.querySelector('[data-action="copy-text"]');

      expect(button.getAttribute('data-copy-value')).toBe('Title as fallback');
    });
  });

  describe('Copy Link button', () => {
    it('creates Copy Link button with correct attributes', () => {
      const el = SocialShare({ url: 'https://test.com/law/123', lawId: '123' });
      const button = el.querySelector('[data-action="copy-link"]');

      expect(button.getAttribute('role')).toBe('menuitem');
      expect(button.getAttribute('data-action')).toBe('copy-link');
      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/law/123');
      expect(button.getAttribute('data-law-id')).toBe('123');
      expect(button.type).toBe('button');
    });

    it('uses window.location.href as fallback for url', () => {
      const el = SocialShare();
      const button = el.querySelector('[data-action="copy-link"]');

      expect(button.getAttribute('data-copy-value')).toBe('https://test.com/page');
    });
  });

  describe('Copy feedback', () => {
    it('includes copy feedback element in popover', () => {
      const el = SocialShare();
      const feedback = el.querySelector('.share-copy-feedback');

      expect(feedback).toBeTruthy();
      expect(feedback.textContent).toContain('Copied!');
    });
  });

  describe('Popover toggle behavior', () => {
    it('toggles popover open on trigger click', () => {
      const el = SocialShare();
      document.body.appendChild(el);
      
      const trigger = el.querySelector('.share-trigger');
      const popover = el.querySelector('.share-popover');
      
      expect(popover.classList.contains('open')).toBe(false);
      
      trigger.click();
      expect(popover.classList.contains('open')).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      
      trigger.click();
      expect(popover.classList.contains('open')).toBe(false);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      
      document.body.removeChild(el);
    });
  });

  describe('URL encoding', () => {
    it('properly encodes special characters in URL', () => {
      const el = SocialShare({
        url: 'https://test.com/law?id=123&sort=votes',
        title: 'Law with & and = chars'
      });

      const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
      expect(twitterLink.href).toContain(encodeURIComponent('https://test.com/law?id=123&sort=votes'));
    });

    it('properly encodes special characters in title', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Murphy\'s Law: "Everything fails"'
      });

      const twitterLink = el.querySelector('.share-popover-item[href*="twitter"]');
      // Check that special characters are present (browser may encode ' as %27)
      expect(twitterLink.href).toContain('Murphy');
      expect(twitterLink.href).toContain('Law');
      expect(twitterLink.href).toContain('Everything');
      expect(twitterLink.href).toContain('fails');
    });

    it('handles empty description', () => {
      const el = SocialShare({
        url: 'https://test.com',
        title: 'Test',
        description: ''
      });

      const linkedinLink = el.querySelector('.share-popover-item[href*="linkedin"]');
      expect(linkedinLink.href).toContain('summary=');
    });
  });

  describe('Platform-specific URLs', () => {
    it('creates correct Twitter intent URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="twitter"]');
      expect(link.href).toContain('https://twitter.com/intent/tweet?url=');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('&text=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('Law');
    });

    it('creates correct Facebook sharer URL', () => {
      const el = SocialShare({ url: 'https://murphys-laws.com/law/42' });

      const link = el.querySelector('.share-popover-item[href*="facebook"]');
      const expectedUrl = 'https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent('https://murphys-laws.com/law/42');

      expect(link.href).toBe(expectedUrl);
    });

    it('creates correct LinkedIn share URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law',
        description: 'Anything that can go wrong'
      });

      const link = el.querySelector('.share-popover-item[href*="linkedin"]');
      expect(link.href).toContain('https://www.linkedin.com/shareArticle?mini=true');
      expect(link.href).toContain('url=' + encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('title=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('summary=' + encodeURIComponent('Anything that can go wrong'));
    });

    it('creates correct Reddit submit URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="reddit"]');
      expect(link.href).toContain('https://www.reddit.com/submit?url=');
      expect(link.href).toContain(encodeURIComponent('https://murphys-laws.com/law/42'));
      expect(link.href).toContain('&title=');
      expect(link.href).toContain('Murphy');
      expect(link.href).toContain('Law');
    });

    it('creates correct mailto URL', () => {
      const el = SocialShare({
        url: 'https://murphys-laws.com/law/42',
        title: 'Murphy\'s Law'
      });

      const link = el.querySelector('.share-popover-item[href*="mailto"]');
      expect(link.href).toContain('mailto:?subject=');
      expect(link.href).toContain('&body=');
    });
  });
});

describe('renderShareButtonsHTML', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { href: 'https://test.com/page', origin: 'https://test.com' };
  });

  it('returns HTML string with share-wrapper class', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-wrapper"');
  });

  it('includes share trigger button', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-trigger"');
    expect(html).toContain('Share');
  });

  it('includes share popover with menu items', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('class="share-popover"');
    expect(html).toContain('share-popover-item');
  });

  it('includes all social platform links', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('twitter.com/intent/tweet');
    expect(html).toContain('facebook.com/sharer');
    expect(html).toContain('linkedin.com/shareArticle');
    expect(html).toContain('reddit.com/submit');
    expect(html).toContain('mailto:');
  });

  it('includes copy buttons with correct data attributes', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law text' });
    expect(html).toContain('data-action="copy-text"');
    expect(html).toContain('data-action="copy-link"');
    expect(html).toContain('data-law-id="123"');
  });

  it('escapes special characters in lawText', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test "quoted" law' });
    expect(html).toContain('&quot;');
  });

  it('includes copy feedback element', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    expect(html).toContain('share-copy-feedback');
    expect(html).toContain('Copied!');
  });
});

describe('initSharePopovers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes popover behavior for share wrappers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    initSharePopovers(container);

    const trigger = container.querySelector('.share-trigger');
    const popover = container.querySelector('.share-popover');

    expect(trigger.dataset.initialized).toBe('true');
    
    // Test toggle functionality
    trigger.click();
    expect(popover.classList.contains('open')).toBe(true);
  });

  it('does not re-initialize already initialized popovers', () => {
    const html = renderShareButtonsHTML({ lawId: '123', lawText: 'Test law' });
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    initSharePopovers(container);
    initSharePopovers(container); // Call again

    const trigger = container.querySelector('.share-trigger');
    // Should still work normally, no double event listeners
    trigger.click();
    const popover = container.querySelector('.share-popover');
    expect(popover.classList.contains('open')).toBe(true);
  });
});
