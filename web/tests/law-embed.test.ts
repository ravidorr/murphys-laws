import { describe, it, expect } from 'vitest';
import {
  EMBED_DEFAULT_HEIGHT,
  buildEmbedIframe,
  embedHeightForText,
  lawEmbedPath,
  lawImagePath,
  lawImageUrl,
  oembedDiscoveryLink
} from '../../shared/modules/law-embed.ts';

describe('law embed helpers', () => {
  it('maps a law and today to their embed paths', () => {
    expect(lawEmbedPath(12)).toBe('/embed/law/12');
    expect(lawEmbedPath('today')).toBe('/embed/law-of-day');
  });

  it('sizes the card to the text', () => {
    expect(embedHeightForText('x'.repeat(140))).toBe(220);
    expect(embedHeightForText('x'.repeat(141))).toBe(300);
    expect(embedHeightForText('x'.repeat(280))).toBe(300);
    expect(embedHeightForText('x'.repeat(281))).toBe(380);
    expect(buildEmbedIframe({ target: 1, text: 'x'.repeat(281) })).toContain('height="380"');
    expect(buildEmbedIframe({ target: 1, text: 'x'.repeat(281), height: 200 })).toContain('height="200"');
  });

  it('gives the image as a relative path and an absolute URL', () => {
    expect(lawImagePath(7)).toBe('/api/v1/og/law/7.png');
  });

  it('points the image at the law image endpoint', () => {
    expect(lawImageUrl(7)).toBe('https://murphys-laws.com/api/v1/og/law/7.png');
  });

  it('builds a responsive iframe by default', () => {
    const html = buildEmbedIframe({ target: 3 });
    expect(html).toContain('src="https://murphys-laws.com/embed/law/3"');
    expect(html).toContain('width="100%"');
    expect(html).toContain(`height="${EMBED_DEFAULT_HEIGHT}"`);
    expect(html).toContain('loading="lazy"');
  });

  it('builds a fixed-size iframe and escapes the title', () => {
    const html = buildEmbedIframe({ target: 'today', width: 480, height: 200, title: 'A "quoted" <law> & more' });
    expect(html).toContain('src="https://murphys-laws.com/embed/law-of-day"');
    expect(html).toContain('width="480"');
    expect(html).toContain('frameborder="0"');
    expect(html).not.toContain('style=');
    expect(html).toContain('title="A &quot;quoted&quot; &lt;law&gt; &amp; more"');
  });

  it('advertises the oEmbed endpoint for a law page', () => {
    expect(oembedDiscoveryLink(5)).toBe(
      `<link rel="alternate" type="application/json+oembed" href="https://murphys-laws.com/api/v1/oembed?url=${encodeURIComponent('https://murphys-laws.com/law/5')}" title="Murphy's Law oEmbed">`
    );
  });
});
