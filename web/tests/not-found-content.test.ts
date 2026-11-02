import { describe, expect, it } from 'vitest';
import {
  NOT_FOUND_LAW_COUNT,
  renderNotFoundContent,
  renderNotFoundLaws,
} from '../src/utils/not-found-content.ts';
import { DEFAULT_NOT_FOUND_LINE } from '../src/utils/not-found-lines.ts';
import type { NotFoundLaw } from '../src/utils/not-found-content.ts';

const law = (overrides: Partial<NotFoundLaw> = {}): NotFoundLaw => ({
  id: 7,
  text: 'If it can fail, it will.',
  ...overrides,
});

describe('renderNotFoundLaws', () => {
  it('links each law and omits attribution when there is none', () => {
    const html = renderNotFoundLaws([law()]);
    expect(html).toContain('href="/law/7"');
    expect(html).toContain('If it can fail, it will.');
    expect(html).not.toContain('not-found-law-meta');
  });

  it('prefixes the title and shows the first attribution', () => {
    const html = renderNotFoundLaws([
      law({ title: 'Law', attributions: [{ name: 'Jim' }] }),
    ]);
    expect(html).toContain('Law: If it can fail, it will.');
    expect(html).toContain('- Jim');
  });

  it('escapes quotes and ampersands', () => {
    expect(renderNotFoundLaws([law({ text: `A & "B" 'C'` })])).toContain(
      'A &amp; &quot;B&quot; &#39;C&#39;',
    );
  });

  it('tolerates a law without text', () => {
    expect(renderNotFoundLaws([{ id: 1 }, { id: 2, title: 'T' }])).toContain('T: ');
  });

  it('escapes law text and limits the count', () => {
    const laws = Array.from({ length: NOT_FOUND_LAW_COUNT + 2 }, (_, i) =>
      law({ id: i + 1, text: '<b>x</b>' }),
    );
    const html = renderNotFoundLaws(laws);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html.match(/<article/g)).toHaveLength(NOT_FOUND_LAW_COUNT);
  });
});

describe('renderNotFoundContent', () => {
  it('renders the default line and hides the laws section without laws', () => {
    const html = renderNotFoundContent();
    expect(html).toContain('Page</span> Not Found');
    expect(html).toContain(DEFAULT_NOT_FOUND_LINE.replaceAll("'", '&#39;'));
    expect(html).toMatch(/not-found-laws-section"[^>]*hidden/);
  });

  it('renders a custom line and shows the laws section when laws are given', () => {
    const html = renderNotFoundContent({ line: 'Custom line', lawsHtml: '<article></article>' });
    expect(html).toContain('Custom line');
    expect(html).not.toMatch(/not-found-laws-section"[^>]*hidden/);
    expect(html).toContain('<article></article>');
  });
});
