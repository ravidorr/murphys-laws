import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SpaController } from '../../src/controllers/spa.controller.ts';

describe('SpaController', () => {
  let mockHtmlInjection: { getLawHtml: ReturnType<typeof vi.fn>; getCategoryHtml: ReturnType<typeof vi.fn> };
  let controller: SpaController;
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;

  beforeEach(() => {
    mockHtmlInjection = {
      getLawHtml: vi.fn(),
      getCategoryHtml: vi.fn(),
    };
    controller = new SpaController(mockHtmlInjection as never);
    mockReq = {} as IncomingMessage;
    mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
  });

  describe('serveLaw', () => {
    it('returns 200 with HTML when getLawHtml returns content', async () => {
      const html = '<!DOCTYPE html><html><body>Law content</body></html>';
      mockHtmlInjection.getLawHtml.mockResolvedValue(html);

      await controller.serveLaw(mockReq, mockRes, '1');

      expect(mockHtmlInjection.getLawHtml).toHaveBeenCalledWith('1');
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      });
      expect(mockRes.end).toHaveBeenCalledWith(html);
    });

    it('returns 404 when getLawHtml returns null', async () => {
      mockHtmlInjection.getLawHtml.mockResolvedValue(null);

      await controller.serveLaw(mockReq, mockRes, '999');

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/html; charset=utf-8' });
      expect(mockRes.end).toHaveBeenCalledWith(
        expect.stringContaining('Not Found')
      );
    });

    it('returns 500 when getLawHtml throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHtmlInjection.getLawHtml.mockRejectedValue(new Error('read failed'));

      await controller.serveLaw(mockReq, mockRes, '1');

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      expect(mockRes.end).toHaveBeenCalledWith('Internal Server Error');
      consoleSpy.mockRestore();
    });
  });

  describe('serveCategory', () => {
    it('returns 200 with HTML when getCategoryHtml returns content', async () => {
      const html = '<!DOCTYPE html><html><body>Category content</body></html>';
      mockHtmlInjection.getCategoryHtml.mockResolvedValue(html);

      await controller.serveCategory(mockReq, mockRes, 'murphys-computers-laws');

      expect(mockHtmlInjection.getCategoryHtml).toHaveBeenCalledWith('murphys-computers-laws');
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      });
      expect(mockRes.end).toHaveBeenCalledWith(html);
    });

    it('returns 404 when getCategoryHtml returns null', async () => {
      mockHtmlInjection.getCategoryHtml.mockResolvedValue(null);

      await controller.serveCategory(mockReq, mockRes, 'nonexistent-slug');

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/html; charset=utf-8' });
      expect(mockRes.end).toHaveBeenCalledWith(
        expect.stringContaining('Not Found')
      );
    });

    it('returns 500 when getCategoryHtml throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHtmlInjection.getCategoryHtml.mockRejectedValue(new Error('read failed'));

      await controller.serveCategory(mockReq, mockRes, 'tech');

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      expect(mockRes.end).toHaveBeenCalledWith('Internal Server Error');
      consoleSpy.mockRestore();
    });
  });
});
