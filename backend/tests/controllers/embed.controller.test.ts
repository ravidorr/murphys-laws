import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EmbedController } from '../../src/controllers/embed.controller.ts';

describe('EmbedController', () => {
  const embedService = {
    getLawEmbedHtml: vi.fn(),
    getLawOfDayEmbedHtml: vi.fn(),
    getOEmbed: vi.fn(),
  };
  let controller: EmbedController;
  const req = {} as IncomingMessage;
  let res: ServerResponse;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    controller = new EmbedController(embedService as never);
    res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
  });

  describe('serveLaw', () => {
    it('serves the card with a short cache', async () => {
      embedService.getLawEmbedHtml.mockResolvedValue('<html>card</html>');
      await controller.serveLaw(req, res, '5');
      expect(embedService.getLawEmbedHtml).toHaveBeenCalledWith('5');
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      expect(res.end).toHaveBeenCalledWith('<html>card</html>');
    });

    it('answers 404 when the law does not exist', async () => {
      embedService.getLawEmbedHtml.mockResolvedValue(null);
      await controller.serveLaw(req, res, '5');
      expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/html; charset=utf-8' });
    });

    it('answers 500 when rendering fails', async () => {
      embedService.getLawEmbedHtml.mockRejectedValue(new Error('boom'));
      await controller.serveLaw(req, res, '5');
      expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      expect(res.end).toHaveBeenCalledWith('Internal Server Error');
    });
  });

  describe('serveLawOfDay', () => {
    it("serves today's card", async () => {
      embedService.getLawOfDayEmbedHtml.mockResolvedValue('<html>today</html>');
      await controller.serveLawOfDay(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Cache-Control': 'public, max-age=300' }));
    });

    it('answers 404 when there is no law of the day', async () => {
      embedService.getLawOfDayEmbedHtml.mockResolvedValue(null);
      await controller.serveLawOfDay(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });

  describe('oembed', () => {
    it('returns the oEmbed document with CORS and caching headers', async () => {
      embedService.getOEmbed.mockResolvedValue({ ok: true, body: { version: '1.0', cache_age: 3600 } });
      await controller.oembed(req, res, { query: { url: 'https://murphys-laws.com/law/5' } });
      expect(embedService.getOEmbed).toHaveBeenCalledWith({ url: 'https://murphys-laws.com/law/5' });
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ version: '1.0', cache_age: 3600 }));
    });

    it('passes an empty query when none was parsed', async () => {
      embedService.getOEmbed.mockResolvedValue({ ok: false, status: 400, message: 'bad url' });
      await controller.oembed(req, res, {});
      expect(embedService.getOEmbed).toHaveBeenCalledWith({});
      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json; charset=utf-8' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'bad url' }));
    });

    it('answers 500 when the service throws', async () => {
      embedService.getOEmbed.mockRejectedValue(new Error('boom'));
      await controller.oembed(req, res, { query: {} });
      expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json; charset=utf-8' });
    });
  });
});
