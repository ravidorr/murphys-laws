import { describe, it, expect, vi } from 'vitest';
import { getPageContent, getPageMetadata, markdownToHtml } from '../src/utils/markdown-content.js';
import { marked } from 'marked';

describe('markdown-content.js', () => {
  describe('markdownToHtml', () => {
    it('converts markdown to HTML with card wrapper', () => {
      const markdown = '# Hello World\nThis is a test.';
      const html = markdownToHtml(markdown);
      
      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<h1>Hello World</h1>');
      expect(html).toContain('<p>This is a test.</p>');
      expect(html).toContain('</article>');
    });

    it('adds last updated date when provided', () => {
      const markdown = '# Hello World\nThis is a test.';
      const html = markdownToHtml(markdown, { lastUpdated: '2023-01-01' });
      
      expect(html).toContain('<header class="content-header">');
      expect(html).toContain('Last updated: 2023-01-01');
      expect(html).toContain('<h1>Hello World</h1>');
    });

    it('handles content without h1 when adding last updated', () => {
      const markdown = 'Just a paragraph.';
      const html = markdownToHtml(markdown, { lastUpdated: '2023-01-01' });
      
      // Should append content if no h1 found
      expect(html).toContain('<p>Just a paragraph.</p>');
      // Implementation detail: it might NOT add the header if h1 is missing, or it might append.
      // Based on code: if (headerMatch) ... else output += html;
      // So if no h1, it just outputs html WITHOUT the header.
      expect(html).not.toContain('Last updated:');
    });
  });

  describe('getPageContent', () => {
    it('returns HTML content for about page', () => {
      const html = getPageContent('about');

      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<div class="card-content">');
      expect(html).toContain('About');
      expect(html).toContain('Murphy');
      expect(html).toContain('</article>');
    });

    it('returns HTML content for privacy page', () => {
      const html = getPageContent('privacy');
      expect(html).toContain('Privacy');
      expect(html).toContain('Policy');
    });

    it('returns HTML content for terms page', () => {
      const html = getPageContent('terms');
      expect(html).toContain('Terms of Service');
    });

    it('returns HTML content for contact page', () => {
      const html = getPageContent('contact');
      expect(html).toContain('Contact');
    });

    it('includes last updated date for privacy page', () => {
      const html = getPageContent('privacy');
      expect(html).toContain('Last updated:');
      // Verify "Last updated:" appears only once
      const lastUpdatedMatches = html.match(/Last updated:/g);
      expect(lastUpdatedMatches).toBeTruthy();
      expect(lastUpdatedMatches.length).toBe(1);
    });

    it('includes last updated date for terms page', () => {
      const html = getPageContent('terms');
      expect(html).toContain('Last updated:');
    });

    it('does not include last updated date for about page', () => {
      const html = getPageContent('about');
      expect(html).not.toContain('Last updated:');
    });

    it('does not include last updated date for contact page', () => {
      const html = getPageContent('contact');
      expect(html).not.toContain('Last updated:');
    });

    it('applies styling enhancements to h1 tags', () => {
      const html = getPageContent('about');
      expect(html).toContain('<h1><span class="accent-text">');
    });

    it('applies styling enhancements to h2 tags', () => {
      const html = getPageContent('about');
      expect(html).toContain('<h2><span class="accent-text">');
    });

    it('applies styling enhancements to h3 tags', () => {
      const html = getPageContent('about');
      expect(html).toContain('<h3><span class="accent-text">');
    });

    it('wraps h2 sections properly', () => {
      const html = getPageContent('about');
      expect(html).toContain('<section class="content-section">');
    });

    it('includes lead paragraph in header for privacy page', () => {
      const html = getPageContent('privacy');
      expect(html).toContain('<p class="lead">');
    });

    it('throws error for unknown page', () => {
      expect(() => {
        getPageContent('unknown-page');
      }).toThrow();
    });
  });

  describe('getPageMetadata', () => {
    it('returns metadata for about page', () => {
      const metadata = getPageMetadata('about');
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
    });

    it('returns undefined for unknown page', () => {
      const metadata = getPageMetadata('unknown-page');
      expect(metadata).toBeUndefined();
    });
  });

  describe('edge cases and branch coverage', () => {
    it('does not style headings with nested HTML tags', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1><em>Italic</em> Heading</h1>');
      const html = getPageContent('about');
      expect(html).not.toContain('<span class="accent-text">');
      expect(html).toContain('<h1><em>Italic</em> Heading</h1>');
      vi.restoreAllMocks();
    });

    it('handles empty heading text gracefully', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1> </h1>');
      const html = getPageContent('about');
      // Should NOT wrap empty string or space if trimmed is empty
      expect(html).toContain('<h1> </h1>');
      expect(html).not.toContain('<span class="accent-text">');
      vi.restoreAllMocks();
    });

    it('handles headings without word characters', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1>!!!</h1>');
      const html = getPageContent('about');
      expect(html).toContain('<h1><span class="accent-text">!!!</span></h1>');
      vi.restoreAllMocks();
    });

    it('handles headings with single word', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1>Single</h1>');
      const html = getPageContent('about');
      expect(html).toContain('<h1><span class="accent-text">Single</span></h1>');
      vi.restoreAllMocks();
    });

    it('handles sections without closing tags correctly', () => {
      // Logic in enhanceMarkdownHtml adds closing tags
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h1>Title</h1><p>Intro</p><h2>Section 1</h2><p>C1</p><h2>Section 2</h2><p>C2</p>'
      );
      const html = getPageContent('about');
      expect(html).toContain('</section>');
      
      // Should wrap both sections
      expect(html).toContain('<section class="content-section">\n      <h2><span class="accent-text">Section</span> 1</h2>');
      expect(html).toContain('<section class="content-section">\n      <h2><span class="accent-text">Section</span> 2</h2>');
      
      // Should have 2 sections
      const sections = (html.match(/<section class="content-section">/g) || []).length;
      expect(sections).toBe(2);
      vi.restoreAllMocks();
    });

    it('handles case where h1Match is null', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h2>No H1</h2><p>Content</p>');
      const html = getPageContent('about');
      expect(html).toContain('<article class="card content-card">');
      vi.restoreAllMocks();
    });

    it('handles headings starting with HTML entities', () => {
      const html = getPageContent('origin-story');
      expect(html).toContain('&quot;<span class="accent-text">If</span>');
    });

    it('handles headings starting with hexadecimal HTML entities', () => {
      vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1>&#x22;Hello&#x22;</h1>');
      const html = getPageContent('about');
      expect(html).toContain('&#x22;<span class="accent-text">Hello</span>');
      vi.restoreAllMocks();
    });
    
    it('handles content without paragraph after h1', () => {
        vi.spyOn(marked, 'parse').mockReturnValueOnce('<h1>Title</h1><h2>Section</h2>');
        const html = getPageContent('about');
        expect(html).toContain('<header class="content-header">');
        expect(html).not.toContain('<p class="lead">');
        vi.restoreAllMocks();
    });
  });
});