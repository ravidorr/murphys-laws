import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LawService } from '../../src/services/laws.service.ts';
import type { CategoryService } from '../../src/services/categories.service.ts';
import { HtmlInjectionService } from '../../src/services/html-injection.service.ts';

const MINIMAL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>Default</title>
  <meta name="description" content="Default description">
  <link rel="canonical" href="https://example.com">
  <meta property="og:url" content="https://example.com">
  <meta property="og:title" content="Default">
  <meta property="og:description" content="Default">
  <meta property="og:image" content="https://example.com/og.png">
  <meta property="twitter:url" content="https://example.com">
  <meta property="twitter:title" content="Default">
  <meta property="twitter:description" content="Default">
  <meta property="twitter:image" content="https://example.com/og.png">
</head>
<body>
  <main id="main-content"><p>Loading...</p></main>
</body>
</html>`;

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

describe('HtmlInjectionService', () => {
  let mockLawService: { getLaw: ReturnType<typeof vi.fn> };
  let mockCategoryService: { getCategoryBySlug: ReturnType<typeof vi.fn> };
  let service: HtmlInjectionService;

  beforeEach(async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.default.readFile).mockResolvedValue(MINIMAL_TEMPLATE);

    mockLawService = { getLaw: vi.fn() };
    mockCategoryService = { getCategoryBySlug: vi.fn() };
    service = new HtmlInjectionService({
      lawService: mockLawService as unknown as LawService,
      categoryService: mockCategoryService as unknown as CategoryService,
    });
  });

  describe('getLawHtml', () => {
    it('returns null for non-integer law id', async () => {
      expect(await service.getLawHtml('abc')).toBeNull();
      expect(await service.getLawHtml('1.5')).toBeNull();
      expect(mockLawService.getLaw).not.toHaveBeenCalled();
    });

    it('returns null for zero or negative law id', async () => {
      expect(await service.getLawHtml('0')).toBeNull();
      expect(await service.getLawHtml('-1')).toBeNull();
      expect(mockLawService.getLaw).not.toHaveBeenCalled();
    });

    it('returns null when law does not exist', async () => {
      mockLawService.getLaw.mockResolvedValue(null);
      expect(await service.getLawHtml('999')).toBeNull();
      expect(mockLawService.getLaw).toHaveBeenCalledWith(999);
    });

    it('returns injected HTML when law exists', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 1,
        title: "Murphy's Law",
        text: 'If it can go wrong, it will.',
        attributions: [],
      });

      const html = await service.getLawHtml('1');
      expect(html).not.toBeNull();
      expect(html).toContain("Murphy's Law");
      expect(html).toContain('If it can go wrong, it will.');
      expect(html).toContain('<main');
      expect(html).toContain('Murphy\'s Law Archive');
    });

    it('uses law text as title when law title is null', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 7,
        title: null,
        text: 'When in doubt, it will go wrong.',
        attributions: [],
      });

      const html = await service.getLawHtml('7');
      expect(html).not.toBeNull();
      expect(html).toContain('When in doubt, it will go wrong.');
    });

    it('includes attribution when present', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 2,
        title: 'Test Law',
        text: 'Test text.',
        attributions: [{ name: 'John Doe' }],
      });

      const html = await service.getLawHtml('2');
      expect(html).not.toBeNull();
      expect(html).toContain('John Doe');
    });

    it('escapes HTML in title and text', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 3,
        title: '<script>alert(1)</script>',
        text: 'Text with "quotes" & <tags>',
        attributions: [],
      });

      const html = await service.getLawHtml('3');
      expect(html).not.toBeNull();
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&lt;tags&gt;');
    });

    it('uses empty string when law text is null', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 4,
        title: 'No Text',
        text: null,
        attributions: [],
      });

      const html = await service.getLawHtml('4');
      expect(html).not.toBeNull();
      expect(html).toContain('<blockquote class="law-text"></blockquote>');
    });

    it('omits attribution when attributions is not an array', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 5,
        title: 'No Attribution',
        text: 'Some text.',
        attributions: null,
      });

      const html = await service.getLawHtml('5');
      expect(html).not.toBeNull();
      expect(html).not.toContain('<p class="attribution">');
    });

    it('omits attribution when first attribution has no name', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 6,
        title: 'Unnamed',
        text: 'Text.',
        attributions: [{}],
      });

      const html = await service.getLawHtml('6');
      expect(html).not.toBeNull();
      expect(html).not.toContain('<p class="attribution">');
    });

    it('injects JSON-LD script into <head>', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 1,
        title: "Murphy's Law",
        text: 'If it can go wrong, it will.',
        attributions: [],
      });

      const html = await service.getLawHtml('1');
      expect(html).toContain('<script type="application/ld+json">');
    });

    it('JSON-LD contains valid parseable JSON with correct schema fields', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 10,
        title: 'Test Law',
        text: 'Things go wrong.',
        attributions: [],
      });

      const html = await service.getLawHtml('10');
      const schema = extractJsonLd(html!);
      expect(schema).not.toBeNull();
      expect(schema!['@context']).toBe('https://schema.org');
      expect(schema!['@type']).toContain('Quotation');
      expect(schema!['text']).toBe('Things go wrong.');
      expect(schema!['url']).toContain('/law/10');
    });

    it('JSON-LD includes author when attribution is present', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 11,
        title: 'Attributed Law',
        text: 'Something goes wrong.',
        attributions: [{ name: 'Edward Murphy' }],
      });

      const html = await service.getLawHtml('11');
      const schema = extractJsonLd(html!);
      expect(schema).not.toBeNull();
      expect((schema!['author'] as { name: string }).name).toBe('Edward Murphy');
    });

    it('JSON-LD omits author when no attribution', async () => {
      mockLawService.getLaw.mockResolvedValue({
        id: 12,
        title: 'No Author',
        text: 'No attribution here.',
        attributions: [],
      });

      const html = await service.getLawHtml('12');
      const schema = extractJsonLd(html!);
      expect(schema).not.toBeNull();
      expect(schema!['author']).toBeUndefined();
    });
  });

  describe('getCategoryHtml', () => {
    it('returns null when category does not exist', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue(null);
      expect(await service.getCategoryHtml('nonexistent')).toBeNull();
      expect(mockCategoryService.getCategoryBySlug).toHaveBeenCalledWith('nonexistent');
    });

    it('returns injected HTML when category exists', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 1,
        slug: 'murphys-computers-laws',
        title: "Murphy's Computers Laws",
        description: 'Digital doom and gloom.',
        law_count: 5,
      });

      const html = await service.getCategoryHtml('murphys-computers-laws');
      expect(html).not.toBeNull();
      expect(html).toContain('Computers Laws');
      expect(html).toContain('5 law');
      expect(html).toContain('<main');
    });

    it('uses singular "law" when law_count is 1', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 2,
        slug: 'tech',
        title: 'Tech',
        description: 'Tech laws.',
        law_count: 1,
      });

      const html = await service.getCategoryHtml('tech');
      expect(html).not.toBeNull();
      expect(html).toContain('1 law.');
      expect(html).not.toContain('1 laws');
    });

    it('escapes HTML in category title', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 3,
        slug: 'x',
        title: 'Title with <b>tags</b>',
        description: 'Desc',
        law_count: 0,
      });

      const html = await service.getCategoryHtml('x');
      expect(html).not.toBeNull();
      expect(html).not.toContain('<b>tags</b>');
      expect(html).toContain('&lt;b&gt;tags&lt;/b&gt;');
    });

    it('uses description fallback when category description is empty', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 4,
        slug: 'no-desc',
        title: 'No Description',
        description: '',
        law_count: 0,
      });

      const html = await service.getCategoryHtml('no-desc');
      expect(html).not.toBeNull();
      expect(html).toContain("Browse ");
      expect(html).toContain("Murphy's Law Archive");
    });

    it('uses single-word accent title when category title has one word', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 5,
        slug: 'tech',
        title: 'Technology',
        description: 'Tech.',
        law_count: 2,
      });

      const html = await service.getCategoryHtml('tech');
      expect(html).not.toBeNull();
      expect(html).toContain('accent-text');
      expect(html).toContain('Technology');
    });

    it('handles category with undefined law_count', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 6,
        slug: 'misc',
        title: 'Misc',
        description: 'Misc laws.',
        law_count: undefined,
      });

      const html = await service.getCategoryHtml('misc');
      expect(html).not.toBeNull();
      expect(html).toContain('Explore');
    });

    it('uses slug with dashes replaced when category title is null', async () => {
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 7,
        slug: 'some-category',
        title: null,
        description: 'Desc.',
        law_count: 1,
      });

      const html = await service.getCategoryHtml('some-category');
      expect(html).not.toBeNull();
      expect(html).toContain('some category');
    });

    it('truncates long description to 160 characters', async () => {
      const longDesc = 'a'.repeat(200);
      mockCategoryService.getCategoryBySlug.mockResolvedValue({
        id: 8,
        slug: 'long',
        title: 'Long',
        description: longDesc,
        law_count: 0,
      });

      const html = await service.getCategoryHtml('long');
      expect(html).not.toBeNull();
      const match = html!.match(/content="([^"]*)"/);
      expect(match).not.toBeNull();
      expect(match![1].length).toBe(160);
    });
  });

  describe('readTemplate', () => {
    it('throws when index.html cannot be read', async () => {
      const fs = await import('node:fs/promises');
      vi.mocked(fs.default.readFile).mockRejectedValue(new Error('ENOENT'));
      const badService = new HtmlInjectionService({
        lawService: mockLawService as unknown as LawService,
        categoryService: mockCategoryService as unknown as CategoryService,
      });

      mockLawService.getLaw.mockResolvedValue({ id: 1, title: 'L', text: 'T', attributions: [] });

      await expect(badService.getLawHtml('1')).rejects.toThrow(/Could not read index.html/);
    });

    it('caches template after first read', async () => {
      const fs = await import('node:fs/promises');
      vi.mocked(fs.default.readFile).mockClear();
      mockLawService.getLaw.mockResolvedValue({ id: 1, title: 'L', text: 'T', attributions: [] });
      await service.getLawHtml('1');
      await service.getLawHtml('1');
      expect(fs.default.readFile).toHaveBeenCalledTimes(1);
    });

    it('uses WEB_DIST_PATH when set', async () => {
      const fs = await import('node:fs/promises');
      const prev = process.env.WEB_DIST_PATH;
      process.env.WEB_DIST_PATH = '/tmp/web-dist';
      vi.mocked(fs.default.readFile).mockClear();
      mockLawService.getLaw.mockResolvedValue({ id: 1, title: 'L', text: 'T', attributions: [] });

      const svc = new HtmlInjectionService({
        lawService: mockLawService as unknown as LawService,
        categoryService: mockCategoryService as unknown as CategoryService,
      });
      const html = await svc.getLawHtml('1');
      expect(html).not.toBeNull();
      expect(fs.default.readFile).toHaveBeenCalledWith(
        expect.stringContaining('index.html'),
        'utf-8'
      );
      if (prev !== undefined) process.env.WEB_DIST_PATH = prev;
      else delete process.env.WEB_DIST_PATH;
    });

    it('uses web/dist relative to cwd when cwd does not end with backend', async () => {
      const fs = await import('node:fs/promises');
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/home/runner/work/proj');
      vi.mocked(fs.default.readFile).mockClear();
      mockLawService.getLaw.mockResolvedValue({ id: 1, title: 'L', text: 'T', attributions: [] });

      const svc = new HtmlInjectionService({
        lawService: mockLawService as unknown as LawService,
        categoryService: mockCategoryService as unknown as CategoryService,
      });
      const html = await svc.getLawHtml('1');
      expect(html).not.toBeNull();
      expect(fs.default.readFile).toHaveBeenCalledWith(
        expect.stringMatching(/web[/\\]dist[/\\]index\.html$/),
        'utf-8'
      );
      cwdSpy.mockRestore();
    });
  });
});
