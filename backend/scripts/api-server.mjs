#!/usr/bin/env node
import 'dotenv/config';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Services
import { DatabaseService } from '../src/services/database.service.mjs';
import { EmailService } from '../src/services/email.service.mjs';
import { LawService } from '../src/services/laws.service.mjs';
import { VoteService } from '../src/services/votes.service.mjs';
import { CategoryService } from '../src/services/categories.service.mjs';
import { AttributionService } from '../src/services/attributions.service.mjs';
import { FeedService } from '../src/services/feed.service.mjs';

// Controllers
import { LawController } from '../src/controllers/laws.controller.mjs';
import { VoteController } from '../src/controllers/votes.controller.mjs';
import { CategoryController } from '../src/controllers/categories.controller.mjs';
import { AttributionController } from '../src/controllers/attributions.controller.mjs';
import { HealthController } from '../src/controllers/health.controller.mjs';
import { FeedController } from '../src/controllers/feed.controller.mjs';

// Router
import { Router } from '../src/routes/router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '..', 'murphys.db');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

// Initialize Services
const dbService = new DatabaseService(DB_PATH);
const emailService = new EmailService({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.EMAIL_FROM || 'noreply@murphys-laws.com',
  to: process.env.EMAIL_TO || 'admin@murphys-laws.com'
});

const lawService = new LawService(dbService.db);
const voteService = new VoteService(dbService.db);
const categoryService = new CategoryService(dbService.db);
const attributionService = new AttributionService(dbService.db);
const feedService = new FeedService(lawService);

// Initialize Controllers
const lawController = new LawController(lawService, emailService);
const voteController = new VoteController(voteService, lawService);
const categoryController = new CategoryController(categoryService);
const attributionController = new AttributionController(attributionService);
const healthController = new HealthController(dbService.db);
const feedController = new FeedController(feedService);

// Setup Router
const router = new Router();

// Health
router.get('/api/health', (req, res) => healthController.check(req, res));

// Laws
router.get('/api/v1/laws', (req, res, parsed) => lawController.list(req, res, parsed));
router.get('/api/v1/laws/suggestions', (req, res, parsed) => lawController.suggestions(req, res, parsed));
router.get('/api/v1/laws/:id', (req, res, id) => lawController.get(req, res, id));
router.get('/api/v1/laws/:id/related', (req, res, id) => lawController.getRelated(req, res, id));
router.post('/api/v1/laws', (req, res) => lawController.submit(req, res));
router.get('/api/v1/law-of-day', (req, res) => lawController.getLawOfTheDay(req, res));

// Votes
router.post('/api/v1/laws/:id/vote', (req, res, id) => voteController.vote(req, res, Number(id)));
router.delete('/api/v1/laws/:id/vote', (req, res, id) => voteController.removeVote(req, res, Number(id)));

// Categories
router.get('/api/v1/categories', (req, res) => categoryController.list(req, res));
router.get('/api/v1/categories/:id', (req, res, id) => categoryController.get(req, res, Number(id)));

// Attributions
router.get('/api/v1/attributions', (req, res) => attributionController.list(req, res));

// Feeds
router.get('/api/v1/feed.rss', (req, res) => feedController.getRssFeed(req, res));
router.get('/api/v1/feed.atom', (req, res) => feedController.getAtomFeed(req, res));

// Start Server
const server = http.createServer((req, res) => router.handle(req, res));

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
