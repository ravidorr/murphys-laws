import url from 'node:url';
import * as Sentry from '@sentry/node';
import { notFound } from '../utils/http-helpers.js';
import { getCorsOrigin } from '../middleware/cors.mjs';

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, handler) {
    this.routes.push({
      method,
      path: typeof path === 'string' ? new RegExp(`^${path.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')}$`) : path,
      handler,
      originalPath: path
    });
  }

  get(path, handler) { this.add('GET', path, handler); }
  post(path, handler) { this.add('POST', path, handler); }
  delete(path, handler) { this.add('DELETE', path, handler); }

  async handle(req, res) {
    if (req.method === 'OPTIONS') {
      this.handleOptions(req, res);
      return;
    }

    const parsed = url.parse(req.url, true);
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

  handleOptions(req, res) {
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['*'];

    const origin = getCorsOrigin(req, ALLOWED_ORIGINS);
    const headers = {
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
