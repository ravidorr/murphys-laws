import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MurphysLawsClient } from 'murphys-laws-sdk';
import { formatLawList } from '../format.js';

export function registerGetLawsByCategory(server: McpServer, api: MurphysLawsClient): void {
  server.tool(
    'get_laws_by_category',
    "Browse Murphy's Laws in a specific category. Use list_categories first to discover available category slugs.",
    {
      category_slug: z.string().describe('Category slug (e.g. "computers", "bureaucracy"). Use list_categories to see all available slugs.'),
      limit: z.number().min(1).max(25).default(10).describe('Number of results to return (1-25, default 10)'),
    },
    async ({ category_slug, limit }) => {
      const result = await api.getLawsByCategory(category_slug, {
        limit,
        sort: 'score',
        order: 'desc',
      });

      return {
        content: [{ type: 'text' as const, text: formatLawList(result.data, result.total) }],
      };
    },
  );
}
