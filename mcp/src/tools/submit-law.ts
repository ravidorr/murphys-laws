import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import type { CategoryService } from '../../../backend/src/services/categories.service.ts';
import { checkRateLimit } from '../../../backend/src/middleware/rate-limit.ts';

const MCP_RATE_LIMIT_ID = 'mcp-client';

export function registerSubmitLaw(
  server: McpServer,
  lawService: LawService,
  categoryService: CategoryService,
): void {
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
      // Rate limit: 3 submissions per minute (same as REST API)
      const rateLimit = checkRateLimit(MCP_RATE_LIMIT_ID, 'submit');
      if (!rateLimit.allowed) {
        const resetInSec = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
        return {
          content: [{ type: 'text' as const, text: `Rate limit exceeded. You can submit up to 3 laws per minute. Try again in ${resetInSec} seconds.` }],
          isError: true,
        };
      }

      // Trim and validate (match REST controller behavior)
      const trimmedText = text.trim();
      if (trimmedText.length < 10) {
        return {
          content: [{ type: 'text' as const, text: 'Law text must be at least 10 characters after trimming whitespace.' }],
          isError: true,
        };
      }

      const trimmedTitle = title?.trim() || null;

      let categoryId: number | null = null;

      if (category_slug) {
        const category = await categoryService.getCategoryBySlug(category_slug);
        if (!category) {
          return {
            content: [{ type: 'text' as const, text: `Category "${category_slug}" not found. Use list_categories to see available category slugs.` }],
            isError: true,
          };
        }
        categoryId = category.id;
      }

      const lawId = await lawService.submitLaw({
        title: trimmedTitle ?? '',
        text: trimmedText,
        author: author?.trim() ?? undefined,
        categoryId,
      });

      const lines = [
        `Law submitted successfully! (ID: ${lawId})`,
        '',
        `Title: ${trimmedTitle || '(none)'}`,
        `Text: "${trimmedText}"`,
        `Author: ${author?.trim() || 'Anonymous'}`,
        `Category: ${category_slug || '(none)'}`,
        `Status: in_review`,
        '',
        'The law is now in the review queue and will be published after manual approval.',
      ];

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    },
  );
}
