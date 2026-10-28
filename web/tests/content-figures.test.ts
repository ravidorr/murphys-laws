import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { insertContentFigure, renderContentFigure } from '../src/utils/content-figures.ts';
import { getPageContent, type ContentPage } from '../src/utils/markdown-content.ts';
import { CONTENT_PAGES, wrapInCardStructure } from '@scripts/ssg';

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

  it('shows the photo once, after the intro and inside the card body, on the origin story page', () => {
    const html = getPageContent('origin-story');
    const figureIndex = html.indexOf('<figure');

    expect(html.match(/<figure/g)).toHaveLength(1);
    expect(figureIndex).toBeGreaterThan(html.indexOf('</header>'));
    expect(figureIndex).toBeGreaterThan(html.indexOf('<div class="card-body">'));
    expect(figureIndex).toBeLessThan(html.indexOf('TL;DR'));
    expect(html).toContain('/img/sledtrk.jpg');
  });

  it('keeps the photo out of every other content page', () => {
    for (const { slug } of CONTENT_PAGES.filter((page) => page.slug !== 'origin-story')) {
      expect(renderContentFigure(slug)).toBe('');
      expect(getPageContent(slug as ContentPage)).not.toContain('<figure');
    }
  });

  it('puts the photo in the prerendered card the same way as in the app', () => {
    const lead = '<h1>Title</h1><p>lead</p><p>body</p>';
    const html = insertContentFigure('origin-story', wrapInCardStructure(lead));

    expect(html.match(/<figure/g)).toHaveLength(1);
    expect(html.indexOf('<figure')).toBeGreaterThan(html.indexOf('</header>'));
    expect(html.indexOf('<figure')).toBeLessThan(html.indexOf('<p>body</p>'));

    const noHeading = insertContentFigure('origin-story', wrapInCardStructure('<p>only</p>'));
    expect(noHeading.indexOf('<figure')).toBeLessThan(noHeading.indexOf('<p>only</p>'));
  });

  it('points at a photo that exists in web/public', () => {
    const src = renderContentFigure('origin-story').match(/src="([^"]+)"/)![1]!;

    expect(fs.existsSync(path.resolve(__dirname, '../public', `.${src}`))).toBe(true);
  });
});
