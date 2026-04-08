import { z } from 'zod';
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

interface SubmitSuccessResponse {
  id: number;
  title: string;
  text: string;
  status: string;
  message: string;
}

interface SubmitErrorResponse {
  error: string;
  retryAfter?: number;
}

export function registerSubmitLaw(server: McpServer, api: ApiClient): void {
  server.tool(
    'submit_law',
    "Submit a new Murphy's Law for review. The law will not be published immediately — it goes into a review queue for manual approval. Rate limited to 3 submissions per minute.",
    {
      text: z.string().min(10).max(1000).describe("The law text (10-1000 characters). Should be a pithy, universal observation in the spirit of Murphy's Law."),
      title: z.string().optional().describe('Optional title for the law (e.g. "Murphy\'s Law of Debugging")'),
      author: z.string().optional().describe('Name of the person who coined or submitted this law'),
      category_slug: z.string().optional().describe('Category slug to file the law under. Use list_categories to see available slugs.'),
    },
    async ({ text, title, author, category_slug }) => {
      // Resolve category_slug to category_id if provided
      let categoryId: number | undefined;

      if (category_slug) {
        const categoriesResult = await api.get<CategoriesResponse>('/api/v1/categories');
        const category = categoriesResult.data.find(c => c.slug === category_slug);
        if (!category) {
          return {
            content: [{ type: 'text' as const, text: `Category "${category_slug}" not found. Use list_categories to see available category slugs.` }],
            isError: true,
          };
        }
        categoryId = category.id;
      }

      const body: Record<string, unknown> = { text };
      if (title) body.title = title;
      if (author) body.author = author;
      if (categoryId !== undefined) body.category_id = categoryId;

      const { status, data } = await api.post<SubmitSuccessResponse | SubmitErrorResponse>(
        '/api/v1/laws',
        body,
      );

      if (status === 429) {
        const errData = data as SubmitErrorResponse;
        const retryIn = errData.retryAfter ?? 60;
        return {
          content: [{ type: 'text' as const, text: `Rate limit exceeded. Try again in ${retryIn} seconds.` }],
          isError: true,
        };
      }

      if (status === 400) {
        const errData = data as SubmitErrorResponse;
        return {
          content: [{ type: 'text' as const, text: `Validation error: ${errData.error}` }],
          isError: true,
        };
      }

      if (status !== 201) {
        return {
          content: [{ type: 'text' as const, text: `Unexpected response (status ${status}).` }],
          isError: true,
        };
      }

      const successData = data as SubmitSuccessResponse;

      const lines = [
        `Law submitted successfully! (ID: ${successData.id})`,
        '',
        `Title: ${successData.title || '(none)'}`,
        `Text: "${successData.text}"`,
        `Author: ${author?.trim() || 'Anonymous'}`,
        `Category: ${category_slug || '(none)'}`,
        `Status: ${successData.status}`,
        '',
        'The law is now in the review queue and will be published after manual approval.',
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
