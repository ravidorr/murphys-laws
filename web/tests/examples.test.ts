import { Examples } from '@views/examples.js';
import * as markdownContent from '@utils/markdown-content.js';
import * as structuredData from '@modules/structured-data.js';
import * as ads from '../src/utils/ads.js';
import * as exportContext from '../src/utils/export-context.js';
import * as dom from '@utils/dom.js';

vi.mock('@utils/markdown-content.js', () => ({
  getPageContent: vi.fn().mockReturnValue('<article><h1>Examples</h1><p>Content</p></article>'),
  getRawMarkdownContent: vi.fn().mockReturnValue('# Examples\n\nContent')
}));

vi.mock('@modules/structured-data.js', () => ({
  setJsonLd: vi.fn()
}));

vi.mock('../src/utils/ads.js', () => ({
  triggerAdSense: vi.fn()
}));

vi.mock('../src/utils/export-context.js', () => ({
  setExportContent: vi.fn(),
  clearExportContent: vi.fn(),
  ContentType: { CONTENT: 'CONTENT' }
}));

vi.mock('@utils/dom.js', () => ({
  updateMetaDescription: vi.fn()
}));

describe('Examples view', () => {
  const localThis = {
    el: null,
    originalTitle: null,
  };

  beforeEach(() => {
    localThis.originalTitle = document.title;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (localThis.el?.parentNode) {
      localThis.el.parentNode.removeChild(localThis.el);
    }
    if (localThis.el?.cleanup) {
      localThis.el.cleanup();
    }
    localThis.el = null;
    document.title = localThis.originalTitle;
  });

  it('renders the examples page', () => {
    localThis.el = Examples();

    expect(localThis.el).toBeTruthy();
    expect(localThis.el.className).toContain('container');
    expect(localThis.el.className).toContain('content-page');
    expect(localThis.el.getAttribute('role')).toBe('main');
  });

  it('sets the page title', () => {
    localThis.el = Examples();

    expect(document.title).toContain("Murphy's Law Examples");
    expect(document.title).toContain('Real-Life Situations');
  });

  it('updates meta description', () => {
    localThis.el = Examples();

    expect(dom.updateMetaDescription).toHaveBeenCalledWith(
      expect.stringContaining("Murphy's Law examples")
    );
  });

  it('loads content from getPageContent', () => {
    localThis.el = Examples();

    expect(markdownContent.getPageContent).toHaveBeenCalledWith('examples');
    expect(localThis.el.innerHTML).toContain('Examples');
  });

  it('triggers AdSense', () => {
    localThis.el = Examples();

    expect(ads.triggerAdSense).toHaveBeenCalledWith(localThis.el);
  });

  it('sets export content', () => {
    localThis.el = Examples();

    expect(exportContext.setExportContent).toHaveBeenCalledWith({
      type: 'CONTENT',
      title: "Murphy's Law Examples",
      data: expect.any(String)
    });
    expect(markdownContent.getRawMarkdownContent).toHaveBeenCalledWith('examples');
  });

  it('sets structured data', () => {
    localThis.el = Examples();

    expect(structuredData.setJsonLd).toHaveBeenCalledWith(
      'examples-article',
      expect.objectContaining({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: expect.stringContaining("Murphy's Law Examples"),
        author: expect.objectContaining({
          '@type': 'Person'
        })
      })
    );
  });

  it('handles navigation clicks', () => {
    const onNavigateMock = vi.fn();
    localThis.el = Examples({ onNavigate: onNavigateMock });
    document.body.appendChild(localThis.el);

    // Create a navigation element
    const navLink = document.createElement('a');
    navLink.setAttribute('data-nav', 'home');
    navLink.textContent = 'Home';
    localThis.el.appendChild(navLink);

    // Click the navigation link
    navLink.click();

    expect(onNavigateMock).toHaveBeenCalledWith('home');
  });

  it('does not navigate when onNavigate is not provided', () => {
    localThis.el = Examples(); // No onNavigate
    document.body.appendChild(localThis.el);

    const navLink = document.createElement('a');
    navLink.setAttribute('data-nav', 'home');
    localThis.el.appendChild(navLink);

    // Should not throw
    expect(() => navLink.click()).not.toThrow();
  });

  it('does not navigate when clicking non-nav elements', () => {
    const onNavigateMock = vi.fn();
    localThis.el = Examples({ onNavigate: onNavigateMock });
    document.body.appendChild(localThis.el);

    // Click directly on the container (not a nav element)
    localThis.el.click();

    expect(onNavigateMock).not.toHaveBeenCalled();
  });

  it('handles click events on non-HTMLElement targets gracefully', () => {
    const onNavigateMock = vi.fn();
    localThis.el = Examples({ onNavigate: onNavigateMock });

    // Create event with non-HTMLElement target
    const textNode = document.createTextNode('text');
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: textNode });
    localThis.el.dispatchEvent(event);

    expect(onNavigateMock).not.toHaveBeenCalled();
  });

  it('clears export content on cleanup', () => {
    localThis.el = Examples();

    expect(localThis.el.cleanup).toBeDefined();
    localThis.el.cleanup();

    expect(exportContext.clearExportContent).toHaveBeenCalled();
  });

  it('does not navigate when navTarget is empty', () => {
    const onNavigateMock = vi.fn();
    localThis.el = Examples({ onNavigate: onNavigateMock });
    document.body.appendChild(localThis.el);

    // Create nav element with empty data-nav
    const navLink = document.createElement('a');
    navLink.setAttribute('data-nav', '');
    localThis.el.appendChild(navLink);

    navLink.click();

    // Should not call onNavigate with empty string
    expect(onNavigateMock).not.toHaveBeenCalled();
  });
});
