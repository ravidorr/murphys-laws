import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HtmlInjectionService } from '../services/html-injection.service.ts';

export class SpaController {
  private htmlInjection: HtmlInjectionService;

  constructor(htmlInjection: HtmlInjectionService) {
    this.htmlInjection = htmlInjection;
  }

  async serveLaw(req: IncomingMessage, res: ServerResponse, lawId: string): Promise<void> {
    try {
      const html = await this.htmlInjection.getLawHtml(lawId);
      if (!html) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body><h1>Not Found</h1><p>Law not found.</p></body></html>');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      });
      res.end(html);
    } catch (err) {
      console.error('SPA law HTML injection error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }

  async serveCategory(req: IncomingMessage, res: ServerResponse, slug: string): Promise<void> {
    try {
      const html = await this.htmlInjection.getCategoryHtml(slug);
      if (!html) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body><h1>Not Found</h1><p>Category not found.</p></body></html>');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      });
      res.end(html);
    } catch (err) {
      console.error('SPA category HTML injection error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
}
