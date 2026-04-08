import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import { formatLawList, type LawData } from '../format.js';

interface SearchResponse {
  data: LawData[];
  total: number;
  limit: number;
  offset: number;
}

export function registerGetLawsByCategory(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_laws_by_category',
    "Browse Murphy's Laws in a specific category. Use list_categories first to discover available category slugs.",
    {
      category_slug: z.string().describe('Category slug (e.g. "computers", "bureaucracy"). Use list_categories to see all available slugs.'),
      limit: z.number().min(1).max(25).default(10).describe('Number of results to return (1-25, default 10)'),
    },
    async ({ category_slug, limit }) => {
      const params = new URLSearchParams({
        category_slug,
        limit: String(limit),
        sort: 'score',
        order: 'desc',
      });

      const result = await api.get<SearchResponse>(`/api/v1/laws?${params}`);

      return {
        content: [{ type: 'text' as const, text: formatLawList(result.data, result.total) }],
      };
    },
  );
}
