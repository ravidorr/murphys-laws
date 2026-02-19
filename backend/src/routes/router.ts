import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import url from 'node:url';
import * as Sentry from '@sentry/node';
import { notFound } from '../utils/http-helpers.ts';
import { getCorsOrigin } from '../middleware/cors.ts';

type RouteMethod = 'GET' | 'POST' | 'DELETE';
type ParsedRequestUrl = url.UrlWithParsedQuery & { query: ParsedUrlQuery };
type RouteHandler = (req: IncomingMessage, res: ServerResponse, ...args: any[]) => unknown | Promise<unknown>;

interface RouteDefinition {
  method: RouteMethod;
  path: RegExp;
  handler: RouteHandler;
  originalPath: string | RegExp;
}

function compilePath(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)');
  return new RegExp(`^${pattern}$`);
}

export class Router {
  routes: RouteDefinition[];

  constructor() {
    this.routes = [];
  }

  add(method: RouteMethod, path: string | RegExp, handler: RouteHandler): void {
    this.routes.push({
      method,
      path: typeof path === 'string' ? compilePath(path) : path,
      handler,
      originalPath: path
    });
  }

  get(path: string | RegExp, handler: RouteHandler): void { this.add('GET', path, handler); }
  post(path: string | RegExp, handler: RouteHandler): void { this.add('POST', path, handler); }
  delete(path: string | RegExp, handler: RouteHandler): void { this.add('DELETE', path, handler); }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      this.handleOptions(req, res);
      return;
    }

    const parsed = url.parse(req.url ?? '', true) as ParsedRequestUrl;
    const pathname = parsed.pathname || '';

    for (const route of this.routes) {
      if (route.method === req.method) {
        const match = pathname.match(route.path);
        if (match) {
          const args = match.slice(1);
          try {
            await route.handler(req, res, ...args, parsed);
          } catch (error) {
            // Report error to Sentry for production monitoring
            Sentry.captureException(error);
            console.error('Route handler error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
          return;
        }
      }
    }

    notFound(res, req);
  }

  handleOptions(req: IncomingMessage, res: ServerResponse): void {
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['*'];

    const origin = getCorsOrigin(req, ALLOWED_ORIGINS);
    const headers: OutgoingHttpHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (origin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    res.writeHead(204, headers);
    res.end();
  }
}
