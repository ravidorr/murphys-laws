import { notFound } from '../utils/http-helpers.ts';

/**
 * Controller for generating Open Graph images
 */
export class OgImageController {
  ogImageService: any;

  constructor(ogImageService: any) {
    this.ogImageService = ogImageService;
  }

  /**
   * Generate and return an OG image for a specific law
   * GET /api/v1/og/law/:id.png
   */
  async getLawImage(req: any, res: any, id: number | string) {
    // Parse and validate law ID
    const lawId = Number(id);
    if (!Number.isInteger(lawId) || lawId <= 0) {
      return this.sendError(res, 400, 'Invalid law ID');
    }

    try {
      const imageBuffer = await this.ogImageService.generateLawImage(lawId);

      if (!imageBuffer) {
        return notFound(res, req);
      }

      // Set response headers for PNG image
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
        'X-Content-Type-Options': 'nosniff',
      });

      res.end(imageBuffer);
    } catch (error) {
      console.error('OG image generation error:', error);
      return this.sendError(res, 500, 'Failed to generate image');
    }
  }

  /**
   * Send an error response
   */
  sendError(res: any, statusCode: number, message: string) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}
