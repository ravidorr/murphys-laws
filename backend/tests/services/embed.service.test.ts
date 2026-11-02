import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbedService } from '../../src/services/embed.service.ts';

describe('EmbedService', () => {
  const lawService = {
    getLaw: vi.fn(),
    getLawOfTheDay: vi.fn(),
  };
  let service: EmbedService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmbedService(lawService as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('card cache', () => {
    it('renders a law once and serves repeat views from memory until the entry expires', async () => {
      vi.useFakeTimers();
      lawService.getLaw.mockResolvedValue({ id: 5, text: 'Cached.' });

      const first = await service.getLawEmbedHtml('5');
      const second = await service.getLawEmbedHtml('5');
      expect(second).toBe(first);
      expect(lawService.getLaw).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await service.getLawEmbedHtml('5');
      expect(lawService.getLaw).toHaveBeenCalledTimes(2);
    });

    it("caches the law of the day and does not cache a missing law", async () => {
      lawService.getLawOfTheDay.mockResolvedValue({ law: { id: 8, text: 'Today.' }, featured_date: '2026-11-02' });
      await service.getLawOfDayEmbedHtml();
      await service.getLawOfDayEmbedHtml();
      expect(lawService.getLawOfTheDay).toHaveBeenCalledTimes(1);

      lawService.getLaw.mockResolvedValue(undefined);
      await service.getLawEmbedHtml('9');
      await service.getLawEmbedHtml('9');
      expect(lawService.getLaw).toHaveBeenCalledTimes(2);
    });

    it('stays bounded by dropping the cache when it fills up', async () => {
      lawService.getLaw.mockImplementation(async (id: number) => ({ id, text: `Law ${id}` }));
      for (let id = 1; id <= 500; id += 1) await service.getLawEmbedHtml(String(id));
      expect(lawService.getLaw).toHaveBeenCalledTimes(500);

      await service.getLawEmbedHtml('501');
      await service.getLawEmbedHtml('1');
      expect(lawService.getLaw).toHaveBeenCalledTimes(502);
    });
  });

  describe('getLawEmbedHtml', () => {
    it.each(['0', '-1', 'abc', '1.5'])('returns null for the invalid id %s', async (id) => {
      expect(await service.getLawEmbedHtml(id)).toBeNull();
      expect(lawService.getLaw).not.toHaveBeenCalled();
    });

    it('returns null for an unknown law', async () => {
      lawService.getLaw.mockResolvedValue(undefined);
      expect(await service.getLawEmbedHtml('9')).toBeNull();
    });

    it('renders a standalone, noindexed card that links back and escapes the law text', async () => {
      lawService.getLaw.mockResolvedValue({ id: 5, title: "Murphy's Law", text: 'Tags <b>& "quotes"</b>' });

      const html = await service.getLawEmbedHtml('5');

      expect(html).toContain('<meta name="robots" content="noindex, follow">');
      expect(html).toContain('<base target="_blank">');
      expect(html).toContain('<link rel="canonical" href="https://murphys-laws.com/law/5">');
      expect(html).toContain('<figcaption class="law-embed__label">Murphy&#39;s Law</figcaption>');
      expect(html).toContain('Tags &lt;b&gt;&amp; &quot;quotes&quot;&lt;/b&gt;');
      expect(html).not.toContain('<b>');
      expect(html).toContain('href="https://murphys-laws.com/law/5"');
      expect(html).toContain('/styles/embed.css');
    });

    it('labels the card with the law title when it has a real one, and titles the page after it', async () => {
      lawService.getLaw.mockResolvedValue({ id: 2, title: "Betteridge's law of headlines", text: 'Any headline posed as a question can be answered with "no."' });

      const html = await service.getLawEmbedHtml('2');

      expect(html).toContain('<figcaption class="law-embed__label">Betteridge&#39;s law of headlines</figcaption>');
      expect(html).toContain(`<title>Betteridge&#39;s law of headlines - Murphy's Law Archive</title>`);
    });

    it('tolerates a law with no text', async () => {
      lawService.getLaw.mockResolvedValue({ id: 6, text: null });
      const html = await service.getLawEmbedHtml('6');
      expect(html).toContain('<blockquote class="law-embed__text"></blockquote>');
    });
  });

  describe('getLawOfDayEmbedHtml', () => {
    it('returns null when there is no law of the day', async () => {
      lawService.getLawOfTheDay.mockResolvedValue(null);
      expect(await service.getLawOfDayEmbedHtml()).toBeNull();
    });

    it("renders today's law with the Law of the Day label", async () => {
      lawService.getLawOfTheDay.mockResolvedValue({ law: { id: 8, text: 'Today.' }, featured_date: '2026-11-02' });
      const html = await service.getLawOfDayEmbedHtml();
      expect(html).toContain('Law of the Day');
      expect(html).toContain('Today.');
      expect(html).toContain('https://murphys-laws.com/law/8');
    });

    it('tolerates a law of the day with no text', async () => {
      lawService.getLawOfTheDay.mockResolvedValue({ law: { id: 8 }, featured_date: '2026-11-02' });
      expect(await service.getLawOfDayEmbedHtml()).toContain('<blockquote class="law-embed__text"></blockquote>');
    });
  });

  describe('getOEmbed', () => {
    const law = { id: 5, title: 'Hofstadter', text: 'It takes longer than expected.' };

    it('rejects formats other than json', async () => {
      expect(await service.getOEmbed({ url: 'https://murphys-laws.com/law/5', format: 'xml' })).toMatchObject({ ok: false, status: 501 });
    });

    it('accepts an explicit json format', async () => {
      lawService.getLaw.mockResolvedValue(law);
      expect(await service.getOEmbed({ url: 'https://murphys-laws.com/law/5', format: 'json' })).toMatchObject({ ok: true });
    });

    it.each([
      [undefined],
      [''],
      ['not a url'],
      ['https://example.com/law/5'],
      ['https://murphys-laws.com/browse'],
      ['https://murphys-laws.com/law/abc'],
    ])('rejects the url %j with 400', async (url) => {
      expect(await service.getOEmbed({ url })).toMatchObject({ ok: false, status: 400 });
    });

    it('returns 404 for an unknown law', async () => {
      lawService.getLaw.mockResolvedValue(undefined);
      expect(await service.getOEmbed({ url: 'https://murphys-laws.com/law/99' })).toMatchObject({ ok: false, status: 404 });
      expect(lawService.getLaw).toHaveBeenCalledWith(99);
    });

    it.each([
      'https://murphys-laws.com/law/5',
      'https://www.murphys-laws.com/law/5/',
    ])('returns a rich oEmbed document for %s', async (url) => {
      lawService.getLaw.mockResolvedValue(law);

      const result = await service.getOEmbed({ url });

      expect(result).toMatchObject({ ok: true });
      const body = (result as unknown as { body: Record<string, unknown> }).body;
      expect(body).toMatchObject({
        version: '1.0',
        type: 'rich',
        provider_name: "Murphy's Law Archive",
        provider_url: 'https://murphys-laws.com',
        title: 'Hofstadter',
        width: 600,
        height: 220,
        thumbnail_url: 'https://murphys-laws.com/api/v1/og/law/5.png',
        cache_age: 3600,
      });
      expect(body.html).toContain('src="https://murphys-laws.com/embed/law/5"');
      expect(body.html).toContain('width="600"');
    });

    it('tolerates a law with no text', async () => {
      lawService.getLaw.mockResolvedValue({ id: 5, title: 'Untextured', text: null });
      const result = await service.getOEmbed({ url: 'https://murphys-laws.com/law/5' });
      expect(result).toMatchObject({ ok: true, body: { height: 220, title: 'Untextured' } });
    });

    it('uses the law text as the title for generic-title laws', async () => {
      lawService.getLaw.mockResolvedValue({ id: 5, title: "Murphy's Law", text: "Night vision - isn't." });
      const result = await service.getOEmbed({ url: 'https://murphys-laws.com/law/5' });
      expect((result as unknown as { body: { title: string } }).body.title).toBe("Night vision - isn't");
    });

    it('sizes the card to long laws, and maxheight still wins', async () => {
      const body = async (text: string, extra: object = {}) => {
        lawService.getLaw.mockResolvedValue({ id: 5, title: 'T', text });
        return ((await service.getOEmbed({ url: 'https://murphys-laws.com/law/5', ...extra })) as unknown as { body: { height: number; html: string } }).body;
      };

      expect((await body('x'.repeat(200))).height).toBe(300);
      expect((await body('x'.repeat(300))).height).toBe(380);
      expect((await body('x'.repeat(300))).html).toContain('height="380"');
      expect((await body('x'.repeat(300), { maxheight: '250' })).height).toBe(250);
    });

    it('honors maxwidth and maxheight but never grows past the defaults or below the minimum', async () => {
      lawService.getLaw.mockResolvedValue(law);
      const body = async (extra: object) =>
        ((await service.getOEmbed({ url: 'https://murphys-laws.com/law/5', ...extra })) as unknown as { body: { width: number; height: number } }).body;

      expect(await body({ maxwidth: '400', maxheight: '150' })).toMatchObject({ width: 400, height: 150 });
      expect(await body({ maxwidth: '9999', maxheight: '9999' })).toMatchObject({ width: 600, height: 220 });
      expect(await body({ maxwidth: '100' })).toMatchObject({ width: 240 });
      expect(await body({ maxwidth: 'abc', maxheight: '-5' })).toMatchObject({ width: 600, height: 220 });
      expect(await body({ maxwidth: ['450', '300'] })).toMatchObject({ width: 450 });
    });
  });
});
