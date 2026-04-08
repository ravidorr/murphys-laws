import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LawService } from '../../backend/src/services/laws.service.ts';
import { CategoryService } from '../../backend/src/services/categories.service.ts';
import { registerSearchLaws } from './tools/search-laws.ts';
import { registerGetRandomLaw } from './tools/get-random-law.ts';
import { registerGetLawOfTheDay } from './tools/get-law-of-the-day.ts';
import { registerGetLaw } from './tools/get-law.ts';
import { registerListCategories } from './tools/list-categories.ts';
import { registerGetLawsByCategory } from './tools/get-laws-by-category.ts';
import { registerSubmitLaw } from './tools/submit-law.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveDbPath(): string {
  if (process.env.MURPHYS_DB_PATH) {
    return process.env.MURPHYS_DB_PATH;
  }
  return resolve(__dirname, '..', '..', 'backend', 'murphys.db');
}

export function createServer(): McpServer {
  const dbPath = resolveDbPath();
  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');

  const lawService = new LawService(db);
  const categoryService = new CategoryService(db);

  const server = new McpServer({
    name: 'murphys-laws',
    version: '1.0.0',
  });

  registerSearchLaws(server, lawService);
  registerGetRandomLaw(server, lawService);
  registerGetLawOfTheDay(server, lawService);
  registerGetLaw(server, lawService);
  registerListCategories(server, categoryService);
  registerGetLawsByCategory(server, lawService);
  registerSubmitLaw(server, lawService, categoryService);

  return server;
}
