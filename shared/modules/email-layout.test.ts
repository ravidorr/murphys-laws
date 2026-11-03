import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMAIL_FONT, EMAIL_STYLES, EMAIL_TOKENS, emailButton, emailRow, renderEmailLayout, siteLink } from './email-layout.ts';

const variablesCss = readFileSync(resolve(import.meta.dirname, '../../web/styles/partials/variables.css'), 'utf8');

function cssToken(name: string): string {
  const match = variablesCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`Token --${name} not found in variables.css`);
  const hex = match[1].toLowerCase();
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

describe('email layout', () => {
  it('keeps every email colour equal to its design token', () => {
    for (const [name, value] of Object.entries(EMAIL_TOKENS)) {
      expect(value, `--${name}`).toBe(cssToken(name));
    }
  });

  it('renders a 600px table layout with the header, rows, footer and dark mode support', () => {
    const html = renderEmailLayout({
      title: 'A <title>',
      preheader: 'Preview & more',
      siteUrl: 'https://example.com/',
      bodyRows: emailRow('<p>Body</p>'),
      footerHtml: 'Footer text',
    });
    expect(html).toContain('<title>A &lt;title&gt;</title>');
    expect(html).toContain('Preview &amp; more');
    expect(html).toContain('width="600"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('@media only screen and (max-width: 620px)');
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('If it can go wrong, it will.');
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('Footer text');
  });

  it('builds a button whose background sits on the table cell, with an escaped link', () => {
    const html = emailButton('Go <now>', 'https://example.com/?a=1&b=2');
    expect(html).toContain('bgcolor="#0d5ea1"');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('>Go &lt;now&gt;</a>');
  });

  it('exposes shared text styles that use the site font', () => {
    expect(EMAIL_FONT).toContain('Work Sans');
    expect(EMAIL_STYLES.law).toContain('font-size:26px');
    expect(EMAIL_STYLES.link).toContain('#0d5ea1');
  });

  it('joins a site path with or without a trailing slash on the site URL', () => {
    expect(siteLink('https://example.com/', '/law/1')).toBe('https://example.com/law/1');
    expect(siteLink('https://example.com', '/law/1')).toBe('https://example.com/law/1');
  });

  it('lets the button fill the width on a phone', () => {
    expect(emailButton('Go', 'https://example.com')).toContain('class="em-button-table"');
  });
});
