import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { DatabaseService } from '../services/database.service.ts';
import { EmailService } from '../services/email.service.ts';
import { LawService } from '../services/laws.service.ts';
import { VoteService } from '../services/votes.service.ts';
import { CategoryService } from '../services/categories.service.ts';
import { AttributionService } from '../services/attributions.service.ts';
import { FeedService } from '../services/feed.service.ts';
import { OgImageService } from '../services/og-image.service.ts';

import { LawController } from '../controllers/laws.controller.ts';
import { VoteController } from '../controllers/votes.controller.ts';
import { CategoryController } from '../controllers/categories.controller.ts';
import { AttributionController } from '../controllers/attributions.controller.ts';
import { HealthController } from '../controllers/health.controller.ts';
import { FeedController } from '../controllers/feed.controller.ts';
import { OgImageController } from '../controllers/og-image.controller.ts';

import { Router } from '../routes/router.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvPath = resolve(__dirname, '..', '..', '..', '.env');
const backendEnvPath = resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: backendEnvPath });

function initSentry() {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

export function createApiServer() {
  initSentry();

  const dbPath = resolve(__dirname, '..', '..', 'murphys.db');
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8787);

  const dbService = new DatabaseService(dbPath);
  const db = (dbService as any).db;
  const emailService = new EmailService({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@murphys-laws.com',
    to: process.env.EMAIL_TO || 'admin@murphys-laws.com',
  });

  const lawService = new LawService(db);
  const voteService = new VoteService(db);
  const categoryService = new CategoryService(db);
  const attributionService = new AttributionService(db);
  const feedService = new FeedService(lawService);
  const ogImageService = new OgImageService(lawService);

  const lawController = new LawController(lawService, emailService);
  const voteController = new VoteController(voteService, lawService);
  const categoryController = new CategoryController(categoryService);
  const attributionController = new AttributionController(attributionService);
  const healthController = new HealthController(db);
  const feedController = new FeedController(feedService);
  const ogImageController = new OgImageController(ogImageService);

  const router = new Router();

  router.get('/api/health', (req, res) => healthController.check(req, res));

  router.get('/api/v1/laws', (req, res, parsed) => lawController.list(req, res, parsed));
  router.get('/api/v1/laws/suggestions', (req, res, parsed) => lawController.suggestions(req, res, parsed));
  router.get('/api/v1/laws/:id', (req, res, id) => lawController.get(req, res, id));
  router.get('/api/v1/laws/:id/related', (req, res, id) => lawController.getRelated(req, res, id));
  router.post('/api/v1/laws', (req, res) => lawController.submit(req, res));
  router.get('/api/v1/law-of-day', (req, res) => lawController.getLawOfTheDay(req, res));

  router.post('/api/v1/laws/:id/vote', (req, res, id) => voteController.vote(req, res, Number(id)));
  router.delete('/api/v1/laws/:id/vote', (req, res, id) => voteController.removeVote(req, res, Number(id)));

  router.get('/api/v1/categories', (req, res) => categoryController.list(req, res));
  router.get('/api/v1/categories/:id', (req, res, id) => categoryController.get(req, res, Number(id)));

  router.get('/api/v1/attributions', (req, res) => attributionController.list(req, res));

  router.get('/api/v1/feed.rss', (req, res) => feedController.getRssFeed(req, res));
  router.get('/api/v1/feed.atom', (req, res) => feedController.getAtomFeed(req, res));

  router.get('/api/v1/og/law/:id.png', (req, res, id) => ogImageController.getLawImage(req, res, id));

  const server = http.createServer((req, res) => router.handle(req, res));

  return {
    host,
    port,
    server,
  };
}

export function startApiServer() {
  const { host, port, server } = createApiServer();

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  startApiServer();
}
