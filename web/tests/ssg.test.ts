import { describe, it, expect } from 'vitest';
import {
  wrapFirstWordWithAccent,
  enhanceMarkdownHtml,
  wrapInCardStructure,
  CONTENT_PAGES,
  buildStaticFavoritesContent,
  buildStaticSubmitContent,
  buildStaticCalculatorContent,
  buildStaticLawDetailContent,
  buildStaticHomeContent
} from '@scripts/ssg';

describe('SSG Utilities', () => {
  describe('wrapFirstWordWithAccent', () => {
    it('wraps first word with accent-text span for multi-word text', () => {
      const result = wrapFirstWordWithAccent('About Murphy\'s Law');
      expect(result).toBe('<span class="accent-text">About</span> Murphy\'s Law');
    });

    it('wraps single word with accent-text span', () => {
      const result = wrapFirstWordWithAccent('Contact');
      expect(result).toBe('<span class="accent-text">Contact</span>');
    });

    it('handles empty string', () => {
      const result = wrapFirstWordWithAccent('');
      expect(result).toBe('<span class="accent-text"></span>');
    });
  });

  describe('enhanceMarkdownHtml', () => {
    it('wraps h1 first word with accent-text', () => {
      const html = '<h1>About Us</h1>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<h1><span class="accent-text">About</span> Us</h1>');
    });

    it('wraps h2 first word and creates section', () => {
      const html = '<h2>Our Mission</h2><p>Some content</p>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<section class="content-section">');
      expect(result).toContain('<h2><span class="accent-text">Our</span> Mission</h2>');
    });

    it('wraps h3 first word with accent-text', () => {
      const html = '<h3>Sub Section</h3>';
      const result = enhanceMarkdownHtml(html);
      expect(result).toContain('<h3><span class="accent-text">Sub</span> Section</h3>');
    });

    it('handles multiple h2 sections correctly', () => {
      const html = '<h1>Title</h1><h2>Section One</h2><p>Content 1</p><h2>Section Two</h2><p>Content 2</p>';
      const result = enhanceMarkdownHtml(html);
      
      // Should have two content-section wrappers
      const sectionCount = (result.match(/<section class="content-section">/g) || []).length;
      expect(sectionCount).toBe(2);
      
      // Should close sections properly
      expect(result).toContain('</section>');
    });

    it('removes orphaned closing section tag before first section', () => {
      const html = '<h1>Title</h1><h2>First Section</h2>';
      const result = enhanceMarkdownHtml(html);
      
      // Should not start with </section>
      expect(result.trim().startsWith('</section>')).toBe(false);
    });
  });

  describe('wrapInCardStructure', () => {
    it('extracts h1 into card-header', () => {
      const html = '<h1>Page Title</h1><p>Body content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<h1>Page Title</h1>');
      expect(result).toContain('</header>');
    });

    it('extracts first paragraph as lead text', () => {
      const html = '<h1>Title</h1><p>Lead paragraph text.</p><p>More content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<p class="lead">Lead paragraph text.</p>');
      expect(result).toContain('<div class="card-body">');
    });

    it('puts remaining content in card-body', () => {
      const html = '<h1>Title</h1><p>Lead text</p><section>Body section</section>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Body section');
      expect(result).toContain('</div>');
    });

    it('wraps in article with content-card class', () => {
      const html = '<h1>Title</h1><p>Content</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<article class="card content-card">');
      expect(result).toContain('</article>');
    });

    it('includes lastUpdated when provided', () => {
      const html = '<h1>Privacy Policy</h1><p>Lead text</p>';
      const result = wrapInCardStructure(html, { lastUpdated: '2025-01-15' });
      
      expect(result).toContain('<p class="small">Last updated: 2025-01-15</p>');
    });

    it('omits lastUpdated when not provided', () => {
      const html = '<h1>About</h1><p>Lead text</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).not.toContain('Last updated');
    });

    it('handles HTML without h1 by wrapping all in card-body', () => {
      const html = '<p>Just some content without a heading</p>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<article class="card content-card">');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Just some content without a heading');
      expect(result).not.toContain('<header');
    });

    it('handles h1 without following paragraph', () => {
      const html = '<h1>Title Only</h1><section>Section content</section>';
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<h1>Title Only</h1>');
      expect(result).not.toContain('<p class="lead">');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('Section content');
    });

    it('handles complex HTML with enhanced markdown', () => {
      const html = '<h1><span class="accent-text">About</span> Murphy\'s Law</h1>' +
        '<p>Welcome to the archive.</p>' +
        '<section class="content-section"><h2>Our Mission</h2><p>To preserve laws.</p></section>';
      
      const result = wrapInCardStructure(html);
      
      expect(result).toContain('<header class="card-header content-header">');
      expect(result).toContain('<span class="accent-text">About</span>');
      expect(result).toContain('<p class="lead">Welcome to the archive.</p>');
      expect(result).toContain('<div class="card-body">');
      expect(result).toContain('content-section');
    });
  });
});

describe('SSG Static Route Content', () => {
  it('includes developers as a generated content page', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toContain('developers');
  });

  it('includes SEO hub pages as generated content pages', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toEqual(expect.arrayContaining([
      'best-murphys-laws',
      'funniest-murphys-laws',
      'murphys-laws-about-work',
      'murphys-laws-about-technology',
      'murphys-law-vs-sods-law'
    ]));
  });

  it('includes examples subpages as generated content pages', () => {
    expect(CONTENT_PAGES.map((page) => page.slug)).toEqual(expect.arrayContaining([
      'examples/work',
      'examples/travel',
      'examples/tech',
      'examples/everyday-life'
    ]));
  });

  it('renders a useful static favorites empty state', () => {
    const html = buildStaticFavoritesContent();

    expect(html).toContain('My Favorites');
    expect(html).toContain('stored in your browser');
    expect(html).toContain('/browse');
    expect(html).not.toMatch(/Loading favorites/i);
  });

  it('renders static submit guidance with moderation and attribution copy', () => {
    const html = buildStaticSubmitContent();

    expect(html).toContain("Submit a Murphy's Law");
    expect(html).toMatch(/reviewed by a human/i);
    expect(html).toMatch(/attribution/i);
    expect(html).toContain('/contact');
    expect(html).not.toMatch(/Loading the archive/i);
  });

  it('renders static calculator explainer content for Sod and toast calculators', () => {
    const sod = buildStaticCalculatorContent('sods-law');
    const toast = buildStaticCalculatorContent('buttered-toast');

    expect(sod).toContain("Sod's Law Calculator");
    expect(sod).toMatch(/Urgency/i);
    expect(sod).toMatch(/for entertainment/i);
    expect(toast).toContain('Buttered Toast');
    expect(toast).toMatch(/assumptions/i);
    expect(toast).toMatch(/simulator/i);
  });

  it('renders law detail pages as destination pages', () => {
    const html = buildStaticLawDetailContent({
      id: 42,
      title: 'Test Law',
      text: 'Anything tested can fail.',
      category_slug: 'murphys-technology-laws',
      category_name: "Murphy's Technology Laws",
      attributions: [{ name: 'QA Engineer' }],
      upvotes: 7,
      downvotes: 2
    });

    expect(html).toContain('Anything tested can fail.');
    expect(html).toContain('QA Engineer');
    expect(html).toMatch(/Source status/i);
    expect(html).toMatch(/In context/i);
    expect(html).toMatch(/Related laws/i);
    expect(html).toContain('/category/murphys-technology-laws');
    expect(html).toContain('/examples/tech');
    expect(html).toContain('Technology hub');
    expect(html).toContain('/contact');
  });

  it('renders static homepage content around the primary loops', () => {
    const html = buildStaticHomeContent();

    expect(html).toContain('Search the Archive');
    expect(html).toContain('Human-reviewed');
    expect(html).toContain('submissions');
    expect(html).toContain('since 1998');
    expect(html).toContain('home-proof-point');
    expect(html).toContain('/categories');
    expect(html).toContain('/submit');
    expect(html).toContain('Trending and Recently Added');
    expect(html).not.toMatch(/Loading/i);
  });
});
