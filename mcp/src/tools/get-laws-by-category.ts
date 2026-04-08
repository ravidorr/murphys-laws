import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import { formatLawList } from '../format.ts';

export function registerGetLawsByCategory(server: McpServer, lawService: LawService): void {
  server.tool(
    'get_laws_by_category',
    "Browse Murphy's Laws in a specific category. Use list_categories first to discover available category slugs.",
    {
      category_slug: z.string().describe('Category slug (e.g. "computers", "bureaucracy"). Use list_categories to see all available slugs.'),
      limit: z.number().min(1).max(25).default(10).describe('Number of results to return (1-25, default 10)'),
    },
    async ({ category_slug, limit }) => {
      const { data, total } = await lawService.listLaws({
        limit,
        offset: 0,
        categorySlug: category_slug,
        sort: 'score',
        order: 'desc',
      });

      return {
        content: [{ type: 'text' as const, text: formatLawList(data, total) }],
      };
    },
  );
}
