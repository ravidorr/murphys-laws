import { readFile } from 'node:fs/promises';
import * as Sentry from '@sentry/node';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkAdminAuth } from '../middleware/admin-auth.ts';
import { notFound } from '../utils/http-helpers.ts';

const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'admin-ui');

const ASSETS: Record<string, { file: string; type: string }> = {
  index: { file: 'index.html', type: 'text/html; charset=utf-8' },
  'admin.css': { file: 'admin.css', type: 'text/css; charset=utf-8' },
  'admin.js': { file: 'admin.js', type: 'text/javascript; charset=utf-8' },
  'admin-logic.js': { file: 'admin-logic.js', type: 'text/javascript; charset=utf-8' },
};

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/**
 * Serves the static moderation page. It holds no secrets; the API enforces the token.
 * The page is served without a token whenever the feature is enabled and 404s when it is disabled.
 * Every file the page loads must be listed in ASSETS (admin.js imports admin-logic.js).
 */
export class AdminUiController {
  async serve(req: IncomingMessage, res: ServerResponse, file = 'index'): Promise<void> {
    const asset = Object.hasOwn(ASSETS, file) ? ASSETS[file] : undefined;
    if (checkAdminAuth(req) === 'disabled' || !asset) {
      return notFound(res, req);
    }

    let body: Buffer;
    try {
      body = await readFile(resolve(UI_DIR, asset.file));
    } catch (error) {
      console.error(`Admin UI asset ${asset.file} could not be read:`, error);
      Sentry.captureException(error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      res.end('Admin UI asset unavailable.');
      return;
    }
    res.writeHead(200, { 'Content-Type': asset.type, ...SECURITY_HEADERS });
    res.end(body);
  }
}
