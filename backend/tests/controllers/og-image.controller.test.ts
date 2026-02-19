import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { OgImageController } from '../../src/controllers/og-image.controller.ts';

describe('OgImageController', () => {
  let controller: OgImageController;
  let mockOgImageService: { generateLawImage: ReturnType<typeof vi.fn> };
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;

  beforeEach(() => {
    mockOgImageService = {
      generateLawImage: vi.fn(),
    };
    controller = new OgImageController(mockOgImageService as never);

    mockReq = {
      method: 'GET',
      url: '/api/v1/og/law/1.png',
      headers: {},
    } as IncomingMessage;

    mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
  });

  describe('getLawImage', () => {
    it('should return 400 for invalid law ID', async () => {
      await controller.getLawImage(mockReq, mockRes, 'invalid');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid law ID' }));
    });

    it('should return 400 for negative law ID', async () => {
      await controller.getLawImage(mockReq, mockRes, '-1');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid law ID' }));
    });

    it('should return 400 for zero law ID', async () => {
      await controller.getLawImage(mockReq, mockRes, '0');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid law ID' }));
    });

    it('should return 400 for decimal law ID', async () => {
      await controller.getLawImage(mockReq, mockRes, '1.5');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid law ID' }));
    });

    it('should return 404 for non-existent law', async () => {
      mockOgImageService.generateLawImage.mockResolvedValue(null);

      await controller.getLawImage(mockReq, mockRes, '999');

      expect(mockOgImageService.generateLawImage).toHaveBeenCalledWith(999);
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should return PNG image for valid law', async () => {
      const localThis = {
        imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG magic bytes
      };
      mockOgImageService.generateLawImage.mockResolvedValue(localThis.imageBuffer);

      await controller.getLawImage(mockReq, mockRes, '1');

      expect(mockOgImageService.generateLawImage).toHaveBeenCalledWith(1);
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'image/png',
        'Content-Length': localThis.imageBuffer.length,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      });
      expect(mockRes.end).toHaveBeenCalledWith(localThis.imageBuffer);
    });

    it('should return 500 on service error', async () => {
      mockOgImageService.generateLawImage.mockRejectedValue(new Error('Canvas error'));

      await controller.getLawImage(mockReq, mockRes, '1');

      expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Failed to generate image' }));
    });
  });
});
