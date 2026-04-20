import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MurphysLawsClient } from 'murphys-laws-sdk';
import { registerSearchLaws } from './tools/search-laws.js';
import { registerGetRandomLaw } from './tools/get-random-law.js';
import { registerGetLawOfTheDay } from './tools/get-law-of-the-day.js';
import { registerGetLaw } from './tools/get-law.js';
import { registerListCategories } from './tools/list-categories.js';
import { registerGetLawsByCategory } from './tools/get-laws-by-category.js';
import { registerSubmitLaw } from './tools/submit-law.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export function createServer(): McpServer {
  const baseUrl = process.env.MURPHYS_API_URL || 'https://murphys-laws.com';
  const api = new MurphysLawsClient({
    baseUrl,
    userAgent: `murphys-laws-mcp/${pkg.version}`,
  });

  const server = new McpServer({
    name: 'murphys-laws',
    version: pkg.version,
  });

  registerSearchLaws(server, api);
  registerGetRandomLaw(server, api);
  registerGetLawOfTheDay(server, api);
  registerGetLaw(server, api);
  registerListCategories(server, api);
  registerGetLawsByCategory(server, api);
  registerSubmitLaw(server, api);

  return server;
}
