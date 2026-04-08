import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';

interface Category {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  law_count: number;
}

interface CategoriesResponse {
  data: Category[];
}

export function registerListCategories(server: McpServer, api: ApiClient): void {
  server.tool(
    'list_categories',
    "List all Murphy's Law categories with their slugs and law counts. Use the slug values to filter searches or browse by category.",
    {},
    async () => {
      const result = await api.get<CategoriesResponse>('/api/v1/categories');
      const categories = result.data;

      const lines = categories.map(c => {
        const desc = c.description ? ` — ${c.description}` : '';
        return `- ${c.title} (slug: "${c.slug}", ${c.law_count} laws)${desc}`;
      });

      const text = `Murphy's Law Categories (${categories.length} total)\n\n${lines.join('\n')}`;

      return {
        content: [{ type: 'text' as const, text }],
      };
    },
  );
}
