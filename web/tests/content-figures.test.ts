import { describe, it, expect } from 'vitest';
import { insertContentFigure, renderContentFigure } from '../src/utils/content-figures.ts';
import { getPageContent } from '../src/utils/markdown-content.ts';

describe('content-figures', () => {
  it('renders the origin story photo with alt text, dimensions and a caption', () => {
    const html = renderContentFigure('origin-story');

    expect(html).toContain('<figure class="content-figure">');
    expect(html).toContain('src="/img/sledtrk.jpg"');
    expect(html).toContain('width="604" height="483"');
    expect(html).toMatch(/alt="[^"]+"/);
    expect(html).toContain('<figcaption');
    expect(html).not.toContain('style=');
  });

  it('renders nothing for pages without a figure', () => {
    expect(renderContentFigure('about')).toBe('');
  });

  it('inserts the figure at the start of the first card body only', () => {
    const html = '<div class="card-body"><p>one</p></div><div class="card-body"><p>two</p></div>';
    const result = insertContentFigure('origin-story', html);

    expect(result.indexOf('<figure')).toBeGreaterThan(result.indexOf('<div class="card-body">'));
    expect(result.indexOf('<figure')).toBeLessThan(result.indexOf('<p>one</p>'));
    expect(result.match(/<figure/g)).toHaveLength(1);
  });

  it('leaves html unchanged when the page has no figure or no card body', () => {
    const html = '<div class="card-body"><p>one</p></div>';

    expect(insertContentFigure('about', html)).toBe(html);
    expect(insertContentFigure('origin-story', '<p>no card</p>')).toBe('<p>no card</p>');
  });

  it('shows the photo on the origin story page but not on other pages', () => {
    expect(getPageContent('origin-story')).toContain('/img/sledtrk.jpg');
    expect(getPageContent('about')).not.toContain('/img/sledtrk.jpg');
  });
});
