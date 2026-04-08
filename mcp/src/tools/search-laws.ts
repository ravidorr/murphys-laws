import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import { formatLawList } from '../format.ts';

export function registerSearchLaws(server: McpServer, lawService: LawService): void {
  server.tool(
    'search_laws',
    "Search Murphy's Laws by keyword. Returns matching laws with text, attribution, score, and category.",
    {
      q: z.string().describe('Search query (matches law text and titles)'),
      category_slug: z.string().optional().describe('Filter by category slug (e.g. "computers", "bureaucracy")'),
      limit: z.number().min(1).max(10).default(5).describe('Number of results to return (1-10, default 5)'),
    },
    async ({ q, category_slug, limit }) => {
      const { data, total } = await lawService.listLaws({
        limit,
        offset: 0,
        q,
        categorySlug: category_slug ?? null,
        sort: 'score',
        order: 'desc',
      });

      return {
        content: [{ type: 'text' as const, text: formatLawList(data, total) }],
      };
    },
  );
}
