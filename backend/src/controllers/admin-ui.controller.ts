import { readFile } from 'node:fs/promises';
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

/** Serves the static moderation page. It holds no secrets; the API enforces the token. */
export class AdminUiController {
  async serve(req: IncomingMessage, res: ServerResponse, file = 'index'): Promise<void> {
    const asset = Object.hasOwn(ASSETS, file) ? ASSETS[file] : undefined;
    if (checkAdminAuth(req) === 'disabled' || !asset) {
      return notFound(res, req);
    }

    const body = await readFile(resolve(UI_DIR, asset.file));
    res.writeHead(200, { 'Content-Type': asset.type, ...SECURITY_HEADERS });
    res.end(body);
  }
}
