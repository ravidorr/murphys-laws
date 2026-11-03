import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EMAIL_FONT,
  EMAIL_TOKENS,
  emailButton,
  emailDetails,
  emailEyebrow,
  emailHeading,
  emailLink,
  emailParagraph,
  emailQuote,
  emailRow,
  renderEmailLayout,
  siteLink,
} from './email-layout.ts';

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

  it('builds escaped content blocks that carry the dark-mode classes', () => {
    expect(EMAIL_FONT).toContain('Work Sans');
    expect(emailHeading('A <b>')).toContain('>A &lt;b&gt;</h1>');
    expect(emailHeading('x')).toContain('class="em-fg"');
    expect(emailParagraph('<i>x</i>')).toContain('<i>x</i></p>');
    expect(emailDetails('d')).toContain('class="em-muted"');
    expect(emailEyebrow('A & B')).toContain('>A &amp; B</p>');
    expect(emailLink('https://example.com/?a=1&b=2', 'Go')).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(emailLink('https://example.com', 'Go')).toContain('class="em-link"');
    const quote = emailQuote('If <it> can');
    expect(quote).toContain('font-size:26px');
    expect(quote).toContain('If &lt;it&gt; can');
    expect(quote).toContain('border-left:4px solid #0d5ea1');
  });

  it('joins a site path with or without a trailing slash on the site URL', () => {
    expect(siteLink('https://example.com/', '/law/1')).toBe('https://example.com/law/1');
    expect(siteLink('https://example.com', '/law/1')).toBe('https://example.com/law/1');
  });

  it('lets the button fill the width on a phone', () => {
    expect(emailButton('Go', 'https://example.com')).toContain('class="em-button-table"');
  });
});
