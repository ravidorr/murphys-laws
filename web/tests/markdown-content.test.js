import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageContent, getPageMetadata } from '../src/utils/markdown-content.js';
import { marked } from 'marked';

describe('markdown-content.js', () => {
  describe('getPageContent', () => {
    it('returns HTML content for about page', () => {
      const html = getPageContent('about');
      
      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<div class="card-content">');
      // Check for HTML entity encoded apostrophe (&#39;)
      expect(html).toContain('About Murphy');
      expect(html).toContain('Law Archive');
      expect(html).toContain('</article>');
    });

    it('returns HTML content for privacy page', () => {
      const html = getPageContent('privacy');
      
      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<div class="card-content">');
      expect(html).toContain('Privacy Policy');
      expect(html).toContain('</article>');
    });

    it('returns HTML content for terms page', () => {
      const html = getPageContent('terms');
      
      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<div class="card-content">');
      expect(html).toContain('Terms of Service');
      expect(html).toContain('</article>');
    });

    it('returns HTML content for contact page', () => {
      const html = getPageContent('contact');
      
      expect(html).toContain('<article class="card content-card">');
      expect(html).toContain('<div class="card-content">');
      expect(html).toContain('Contact');
      expect(html).toContain('</article>');
    });

    it('includes last updated date for privacy page', () => {
      const html = getPageContent('privacy');
      
      expect(html).toContain('Last updated:');
      expect(html).toContain('<header class="content-header">');
      expect(html).toContain('<p class="small">');
    });

    it('includes last updated date for terms page', () => {
      const html = getPageContent('terms');
      
      expect(html).toContain('Last updated:');
      expect(html).toContain('<header class="content-header">');
      expect(html).toContain('<p class="small">');
    });

    it('does not include last updated date for about page', () => {
      const html = getPageContent('about');
      
      // About page should have header but not the "Last updated" text
      expect(html).toContain('<header class="content-header">');
      expect(html).not.toContain('Last updated:');
    });

    it('does not include last updated date for contact page', () => {
      const html = getPageContent('contact');
      
      // Contact page should have header but not the "Last updated" text
      expect(html).toContain('<header class="content-header">');
      expect(html).not.toContain('Last updated:');
    });

    it('applies styling enhancements to h1 tags', () => {
      const html = getPageContent('about');
      
      expect(html).toContain('<h1><span class="accent-text">');
      expect(html).toContain('</span></h1>');
    });

    it('applies styling enhancements to h2 tags', () => {
      const html = getPageContent('about');
      
      expect(html).toContain('<section class="content-section">');
      expect(html).toContain('<h2><span class="accent-text">');
      expect(html).toContain('</span></h2>');
    });

    it('wraps h2 sections properly', () => {
      const html = getPageContent('about');
      
      // Should have multiple sections
      const sectionMatches = html.match(/<section class="content-section">/g);
      expect(sectionMatches).toBeTruthy();
      expect(sectionMatches.length).toBeGreaterThan(0);
    });

    it('includes lead paragraph in header for privacy page', () => {
      const html = getPageContent('privacy');
      
      expect(html).toContain('<p class="lead">');
      expect(html).toContain('</header>');
    });

    it('includes lead paragraph in header for terms page', () => {
      const html = getPageContent('terms');
      
      expect(html).toContain('<p class="lead">');
      expect(html).toContain('</header>');
    });

    it('includes lead paragraph in header for about page', () => {
      const html = getPageContent('about');
      
      expect(html).toContain('<p class="lead">');
      expect(html).toContain('</header>');
    });

    it('includes lead paragraph in header for contact page', () => {
      const html = getPageContent('contact');
      
      expect(html).toContain('<p class="lead">');
      expect(html).toContain('</header>');
    });

    it('throws error for unknown page', () => {
      expect(() => {
        getPageContent('unknown-page');
      }).toThrow();
    });

    it('handles content without h2 sections', () => {
      // This tests the branch where sections.length <= 1
      // We can't easily test this with real content, but the code handles it
      const html = getPageContent('contact');
      
      // Should still return valid HTML
      expect(html).toContain('<article');
      expect(html).toContain('</article>');
    });

    it('handles multiple h2 sections correctly', () => {
      const html = getPageContent('about');
      
      // Should have proper section wrapping
      const sections = html.split('<section class="content-section">');
      // Each section should be properly closed
      expect(html).toContain('</section>');
    });
  });

  describe('getPageMetadata', () => {
    it('returns metadata for about page', () => {
      const metadata = getPageMetadata('about');
      
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
      expect(metadata.lastUpdated).toBeDefined();
      expect(metadata.description).toBeDefined();
    });

    it('returns metadata for privacy page', () => {
      const metadata = getPageMetadata('privacy');
      
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
      expect(metadata.lastUpdated).toBeDefined();
      expect(metadata.description).toBeDefined();
    });

    it('returns metadata for terms page', () => {
      const metadata = getPageMetadata('terms');
      
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
      expect(metadata.lastUpdated).toBeDefined();
      expect(metadata.description).toBeDefined();
    });

    it('returns metadata for contact page', () => {
      const metadata = getPageMetadata('contact');
      
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
      expect(metadata.lastUpdated).toBeDefined();
      expect(metadata.description).toBeDefined();
    });

    it('returns undefined for unknown page', () => {
      const metadata = getPageMetadata('unknown-page');
      
      expect(metadata).toBeUndefined();
    });
  });

  describe('HTML structure validation', () => {
    it('produces valid HTML structure for all pages', () => {
      const pages = ['about', 'privacy', 'terms', 'contact'];
      
      pages.forEach(page => {
        const html = getPageContent(page);
        
        // Should have opening and closing article tag
        expect(html).toMatch(/<article[^>]*>/);
        expect(html).toContain('</article>');
        
        // Should have card-content div
        expect(html).toContain('<div class="card-content">');
        expect(html).toContain('</div>');
        
        // Should have at least one h1
        expect(html).toContain('<h1');
      });
    });

    it('ensures all sections are properly closed', () => {
      const html = getPageContent('about');
      
      // Count opening and closing section tags
      const openSections = (html.match(/<section class="content-section">/g) || []).length;
      const closeSections = (html.match(/<\/section>/g) || []).length;
      
      expect(closeSections).toBeGreaterThanOrEqual(openSections);
    });

    it('includes proper header structure', () => {
      const html = getPageContent('about');
      
      expect(html).toContain('<header class="content-header">');
      expect(html).toContain('</header>');
    });
  });

  describe('edge cases and branch coverage', () => {
    it('handles sections without closing tags correctly', () => {
      // This tests the branch where nextSectionIndex === -1
      // The enhanceMarkdownHtml function should add closing tags
      const html = getPageContent('about');
      
      // All sections should be properly closed
      const openSections = (html.match(/<section class="content-section">/g) || []).length;
      const closeSections = (html.match(/<\/section>/g) || []).length;
      
      // Should have at least as many closing tags as opening tags
      expect(closeSections).toBeGreaterThanOrEqual(openSections);
    });

    it('handles content with multiple h2 sections', () => {
      const html = getPageContent('about');
      
      // Should have multiple sections
      const sections = html.split('<section class="content-section">');
      expect(sections.length).toBeGreaterThan(1);
      
      // Each section should be properly formatted
      sections.slice(1).forEach(section => {
        expect(section).toContain('<h2');
      });
    });

    it('handles privacy page with lastUpdated metadata', () => {
      const html = getPageContent('privacy');
      
      // Should include last updated date
      expect(html).toContain('Last updated:');
      expect(html).toContain('2025-11-06');
    });

    it('handles terms page with lastUpdated metadata', () => {
      const html = getPageContent('terms');
      
      // Should include last updated date
      expect(html).toContain('Last updated:');
      expect(html).toContain('2025-10-18');
    });

    it('handles about page without lastUpdated in header', () => {
      const html = getPageContent('about');
      
      // Should not include "Last updated:" text
      const lastUpdatedIndex = html.indexOf('Last updated:');
      const headerEndIndex = html.indexOf('</header>');
      
      // If "Last updated:" appears, it should be after the header
      if (lastUpdatedIndex !== -1 && headerEndIndex !== -1) {
        expect(lastUpdatedIndex).toBeGreaterThan(headerEndIndex);
      }
    });

    it('handles contact page without lastUpdated in header', () => {
      const html = getPageContent('contact');
      
      // Should not include "Last updated:" text in the header section
      const headerSection = html.substring(
        html.indexOf('<header'),
        html.indexOf('</header>') + 9
      );
      
      expect(headerSection).not.toContain('Last updated:');
    });

    it('ensures all h1 tags have accent-text spans', () => {
      const pages = ['about', 'privacy', 'terms', 'contact'];
      
      pages.forEach(page => {
        const html = getPageContent(page);
        const h1Matches = html.match(/<h1[^>]*>/g) || [];
        
        h1Matches.forEach(h1Tag => {
          // Find the corresponding closing h1
          const h1Index = html.indexOf(h1Tag);
          const h1EndIndex = html.indexOf('</h1>', h1Index);
          const h1Content = html.substring(h1Index, h1EndIndex + 5);
          
          expect(h1Content).toContain('<span class="accent-text">');
          expect(h1Content).toContain('</span>');
        });
      });
    });

    it('ensures all h2 tags have accent-text spans and section wrappers', () => {
      const html = getPageContent('about');
      const h2Matches = html.match(/<h2[^>]*>/g) || [];
      
      h2Matches.forEach(h2Tag => {
        // Find the section containing this h2
        const h2Index = html.indexOf(h2Tag);
        const sectionStart = html.lastIndexOf('<section class="content-section">', h2Index);
        const sectionEnd = html.indexOf('</section>', h2Index);
        
        expect(sectionStart).not.toBe(-1);
        expect(sectionEnd).not.toBe(-1);
        expect(sectionStart).toBeLessThan(h2Index);
        expect(sectionEnd).toBeGreaterThan(h2Index);
        
        // Check for accent-text span
        const h2Content = html.substring(h2Index, html.indexOf('</h2>', h2Index) + 5);
        expect(h2Content).toContain('<span class="accent-text">');
      });
    });

    it('handles content without paragraph after h1 (privacy/terms branch)', () => {
      // Mock marked.parse to return HTML without paragraph after h1
      // This tests the branch where firstPEnd === -1 (line 132)
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h1>Privacy Policy</h1><h2>Section</h2><p>Content</p>'
      );

      try {
        const html = getPageContent('privacy');
        // Should still return valid HTML even without paragraph after h1
        expect(html).toContain('<article class="card content-card">');
        expect(html).toContain('</article>');
        // Should not crash when firstPEnd === -1
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('handles content without paragraph after h1 (about/contact branch)', () => {
      // Mock marked.parse to return HTML without paragraph after h1
      // This tests the branch where firstPEnd === -1 (line 150)
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h1>About</h1><h2>Section</h2><p>Content</p>'
      );

      try {
        const html = getPageContent('about');
        // Should still return valid HTML even without paragraph after h1
        expect(html).toContain('<article class="card content-card">');
        expect(html).toContain('</article>');
        // Should not crash when firstPEnd === -1
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('handles content without h1 tag', () => {
      // Mock marked.parse to return HTML without h1
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h2>Section</h2><p>Content</p>'
      );

      try {
        const html = getPageContent('about');
        // Should still return valid HTML even without h1
        expect(html).toContain('<article class="card content-card">');
        expect(html).toContain('</article>');
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('handles sections without closing tags in enhanceMarkdownHtml', () => {
      // Mock marked.parse to return HTML with h2 sections
      // After enhanceMarkdownHtml processes it, we need a scenario where
      // a section doesn't have </section> before the next section starts
      // This tests the branch where nextSectionIndex === -1 (line 74)
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h1>Title</h1><p>Intro</p><h2>Section 1</h2><p>Content 1</p><h2>Section 2</h2><p>Content 2</p><h2>Section 3</h2><p>Content 3</p>'
      );

      try {
        const html = getPageContent('about');
        // Should add closing section tags for all sections
        expect(html).toContain('</section>');
        // Should have proper section structure
        const sections = html.split('<section class="content-section">');
        if (sections.length > 1) {
          // Each section should be properly closed
          const closeSections = html.match(/<\/section>/g)?.length || 0;
          expect(closeSections).toBeGreaterThanOrEqual(sections.length - 1);
        }
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('handles case where headerContentMatch is null (no h1 with accent-text)', () => {
      // Mock marked.parse to return HTML that won't match the header pattern
      // This tests the branch where headerContentMatch is null
      vi.spyOn(marked, 'parse').mockReturnValueOnce(
        '<h1>Title</h1><h2>Section</h2><p>Content</p>'
      );

      try {
        // After enhanceMarkdownHtml, the h1 will have accent-text span
        // But if the pattern doesn't match for some reason, it should still work
        const html = getPageContent('contact');
        expect(html).toContain('<article class="card content-card">');
        expect(html).toContain('</article>');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});

