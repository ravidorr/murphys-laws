import { describe, it, expect } from 'vitest';
import { escapeAttribute, escapeHtml } from '../../shared/modules/html-escape.ts';

describe('html escaping', () => {
  it('escapes every special character for element content and attributes', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  });

  it('returns an empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('keeps apostrophes readable in double-quoted attributes', () => {
    expect(escapeAttribute(`Murphy's "Law" <b> &`)).toBe(`Murphy's &quot;Law&quot; &lt;b&gt; &amp;`);
  });
});
