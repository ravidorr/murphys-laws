import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import url from 'node:url';
import * as Sentry from '@sentry/node';
import { notFound } from '../utils/http-helpers.ts';
import { getCorsOrigin } from '../middleware/cors.ts';
import { OPENAPI_SPEC } from '../openapi.ts';

export type RouteMethod = 'GET' | 'POST' | 'DELETE';
type ParsedRequestUrl = url.UrlWithParsedQuery & { query: ParsedUrlQuery };
type RouteHandler = (req: IncomingMessage, res: ServerResponse, ...args: any[]) => unknown | Promise<unknown>;

interface RouteDefinition {
  method: RouteMethod;
  path: RegExp;
  handler: RouteHandler;
  originalPath: string | RegExp;
}

interface PublicApiOperation {
  method: RouteMethod;
  path: string;
}

type OpenApiPaths = Record<string, Partial<Record<Lowercase<RouteMethod>, unknown>>>;

function compilePath(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)');
  return new RegExp(`^${pattern}$`);
}

function normalizePublicApiPath(path: string): string {
  return path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function operationKey(operation: PublicApiOperation): string {
  return `${operation.method} ${operation.path}`;
}

function getDocumentedPublicApiOperations(): Set<string> {
  const documented = new Set<string>();
  const paths = OPENAPI_SPEC.paths as unknown as OpenApiPaths;
  const methods: RouteMethod[] = ['GET', 'POST', 'DELETE'];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!path.startsWith('/api')) {
      continue;
    }

    for (const method of methods) {
      if (pathItem[method.toLowerCase() as Lowercase<RouteMethod>] !== undefined) {
        documented.add(operationKey({ method, path }));
      }
    }
  }

  return documented;
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

  registerPublicRoute(
    method: RouteMethod,
    runtimePath: string,
    openApiPath: string,
    handler: RouteHandler,
  ): void {
    const normalizedRuntimePath = normalizePublicApiPath(runtimePath);
    if (normalizedRuntimePath !== openApiPath) {
      throw new Error(`Runtime path ${runtimePath} does not match OpenAPI path ${openApiPath}`);
    }

    const operation = { method, path: openApiPath };
    if (!getDocumentedPublicApiOperations().has(operationKey(operation))) {
      throw new Error(`Missing OpenAPI operation: ${operationKey(operation)}`);
    }

    this.add(method, runtimePath, handler);
  }

  assertPublicApiContract(): void {
    const registered = new Set<string>();
    for (const route of this.routes) {
      if (typeof route.originalPath !== 'string' || !route.originalPath.startsWith('/api')) {
        continue;
      }

      const operation = {
        method: route.method,
        path: normalizePublicApiPath(route.originalPath),
      };
      registered.add(operationKey(operation));
    }

    const documented = getDocumentedPublicApiOperations();
    const undocumentedRoutes = [...registered].filter((operation) => !documented.has(operation)).sort();
    if (undocumentedRoutes.length > 0) {
      throw new Error(`Public route has no OpenAPI operation: ${undocumentedRoutes[0]}`);
    }

    const unregisteredOperations = [...documented].filter((operation) => !registered.has(operation)).sort();
    if (unregisteredOperations.length > 0) {
      throw new Error(`OpenAPI operation has no registered public route: ${unregisteredOperations[0]}`);
    }
  }

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
