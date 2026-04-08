import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CategoryService } from '../../../backend/src/services/categories.service.ts';

interface CategoryRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  law_count: number;
}

export function registerListCategories(server: McpServer, categoryService: CategoryService): void {
  server.tool(
    'list_categories',
    "List all Murphy's Law categories with their slugs and law counts. Use the slug values to filter searches or browse by category.",
    {},
    async () => {
      const categories = await categoryService.listCategories() as CategoryRow[];

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
