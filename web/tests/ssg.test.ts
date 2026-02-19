// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { wrapFirstWordWithAccent, enhanceMarkdownHtml, wrapInCardStructure } from '../scripts/ssg.mjs';

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
