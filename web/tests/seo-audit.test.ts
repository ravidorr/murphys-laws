import { describe, it, expect } from 'vitest';
import {
  auditSite,
  decodeEntities,
  duplicates,
  parsePage,
  visibleText,
  type PageInfo
} from '../scripts/seo-audit.ts';

const ORIGIN = 'https://murphys-laws.com';

function page(overrides: Partial<PageInfo> = {}): PageInfo {
  return {
    url: `${ORIGIN}/about`,
    title: 'About',
    description: 'A description that is long enough to be a perfectly reasonable meta description here.',
    canonical: `${ORIGIN}/about`,
    robots: 'index, follow',
    h1Count: 1,
    jsonLdTypes: ['Article'],
    words: 300,
    ...overrides
  };
}

describe('seo-audit helpers', () => {
  it('decodes known entities in a single pass', () => {
    expect(decodeEntities('Murphy&#039;s &amp; Sod&#39;s &quot;law&quot; &lt;b&gt; &apos;x&apos;')).toBe('Murphy\'s & Sod\'s "law" <b> \'x\'');
    expect(decodeEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
  });

  it('extracts visible text and skips script and style contents', () => {
    const html = '<html><head><style>p { color: red }</style><script>var x = "<b>no</b>";</script></head><body><h1>Hello</h1> <p>big   world</p>tail</body></html>';
    const words = visibleText(html).split(/\s+/).filter(Boolean);
    expect(words).toEqual(['Hello', 'big', 'world', 'tail']);
  });

  it('handles unterminated markup and uppercase script tags', () => {
    expect(visibleText('plain text').trim()).toBe('plain text');
    expect(visibleText('a<SCRIPT>hidden').trim()).toBe('a');
    expect(visibleText('a <b').trim()).toBe('a');
  });

  it('parses title, description, canonical, robots, h1 count, json-ld types and word count', () => {
    const html = `<html><head><title>Murphy&#039;s Law</title>
<meta name="description" content="Desc &amp; more">
<link rel="canonical" href="${ORIGIN}/x"><meta name="robots" content="noindex, follow">
<script type="application/ld+json">{"@type":["Article","Quotation"]}</script>
<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
<script type="application/ld+json">{not json</script></head>
<body><h1>One</h1><p>two three</p></body></html>`;
    const info = parsePage(`${ORIGIN}/x`, html);
    expect(info).toMatchObject({
      title: "Murphy's Law",
      description: 'Desc & more',
      canonical: `${ORIGIN}/x`,
      robots: 'noindex, follow',
      h1Count: 1,
      jsonLdTypes: ['Article+Quotation', 'BreadcrumbList', 'INVALID'],
      words: 5 // includes the title text, as the audit always has
    });
  });

  it('returns empty fields for a page with no head metadata', () => {
    const info = parsePage(`${ORIGIN}/y`, '<body>nothing</body>');
    expect(info).toMatchObject({ title: '', description: '', canonical: '', robots: '', h1Count: 0, jsonLdTypes: [] });
  });

  it('finds duplicate values but ignores empty ones', () => {
    const pages = [page({ title: 'A' }), page({ title: 'A' }), page({ title: 'B' }), page({ title: '' }), page({ title: '' })];
    expect(duplicates(pages, 'title')).toEqual([['A', 2]]);
  });
});

describe('auditSite', () => {
  const lawPage = (id: number, title: string, description: string, extra: Partial<PageInfo> = {}) =>
    page({ url: `${ORIGIN}/law/${id}`, canonical: `${ORIGIN}/law/${id}`, title, description, jsonLdTypes: ['BreadcrumbList'], ...extra });
  const longDescription = 'This is a sufficiently long description for a law page in the archive of Murphy laws.';

  it('reports a clean site with no problems', () => {
    const result = auditSite({
      entries: ['<loc>a</loc><lastmod>2026-01-01</lastmod>'],
      pages: [page(), lawPage(1, 'One', longDescription), lawPage(2, 'Two', `${longDescription} More.`)],
      missingFiles: []
    });
    expect(result.blocking).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result).toMatchObject({ pageCount: 3, lawCount: 2, uniqueLawTitles: 2 });
  });

  it('blocks on duplicate law titles and descriptions, missing pages and bad canonicals', () => {
    const result = auditSite({
      entries: ['<loc>a</loc>'],
      pages: [
        lawPage(1, 'Same', longDescription),
        lawPage(2, 'Same', longDescription),
        page({ canonical: `${ORIGIN}/elsewhere`, robots: 'noindex', h1Count: 2, title: '', description: '' })
      ],
      missingFiles: [`${ORIGIN}/gone`]
    });
    const text = result.blocking.join('\n');
    expect(text).toContain('1 sitemap URLs have no built page (e.g. https://murphys-laws.com/gone)');
    expect(text).toContain('2 law pages share 1 titles (e.g. "Same")');
    expect(text).toContain('2 law pages share 1 descriptions');
    expect(text).toContain('canonical mismatch');
    expect(text).toContain('noindex page in sitemap');
    expect(text).toContain('2 h1 elements');
    expect(text).toContain('missing title or description');
  });

  it('warns about sitemap hygiene, lengths, schema, breadcrumbs and thin pages', () => {
    const result = auditSite({
      entries: ['<loc>a</loc>', '<loc>b</loc><lastmod>x</lastmod><changefreq>daily</changefreq>'],
      pages: [
        page({ title: 'T'.repeat(61), description: 'D'.repeat(161), jsonLdTypes: [], words: 10 }),
        lawPage(1, 'Short', 'tiny', { jsonLdTypes: ['Article'] })
      ],
      missingFiles: []
    });
    const text = result.warnings.join('\n');
    expect(text).toContain('1 sitemap URLs have no lastmod');
    expect(text).toContain('1 sitemap URLs still carry changefreq or priority');
    expect(text).toContain('1 titles over 60 characters');
    expect(text).toContain('1 law descriptions under 70 characters');
    expect(text).toContain('1 descriptions over 160 characters');
    expect(text).toContain('1 pages with no JSON-LD');
    expect(text).toContain('1 browse, category and law pages with no BreadcrumbList');
    expect(text).toContain('1 non-law pages under 150 words: /about');
  });
});
