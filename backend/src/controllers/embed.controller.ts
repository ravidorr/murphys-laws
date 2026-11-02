import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EmbedService } from '../services/embed.service.ts';

interface ParsedQuery {
  query?: Record<string, string | string[] | undefined>;
}

const NOT_FOUND_PAGE = '<!DOCTYPE html><html><body><p>Law not found.</p></body></html>';

export class EmbedController {
  private embedService: EmbedService;

  constructor(embedService: EmbedService) {
    this.embedService = embedService;
  }

  /** GET /embed/law/:id */
  async serveLaw(_req: IncomingMessage, res: ServerResponse, lawId: string): Promise<void> {
    await this.sendPage(res, () => this.embedService.getLawEmbedHtml(lawId));
  }

  /** GET /embed/law-of-day */
  async serveLawOfDay(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    await this.sendPage(res, () => this.embedService.getLawOfDayEmbedHtml());
  }

  /** GET /api/v1/oembed?url=...&maxwidth=...&maxheight=... */
  async oembed(_req: IncomingMessage, res: ServerResponse, parsed: ParsedQuery): Promise<void> {
    try {
      const result = await this.embedService.getOEmbed(parsed.query ?? {});
      if (!result.ok) {
        res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: result.message }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `public, max-age=${result.body.cache_age}`
      });
      res.end(JSON.stringify(result.body));
    } catch (err) {
      console.error('oEmbed error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private async sendPage(res: ServerResponse, render: () => Promise<string | null>): Promise<void> {
    try {
      const html = await render();
      if (!html) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(NOT_FOUND_PAGE);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      });
      res.end(html);
    } catch (err) {
      console.error('Embed page error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
}
