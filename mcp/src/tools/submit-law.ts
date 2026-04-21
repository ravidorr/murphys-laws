import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MurphysLawsClient } from 'murphys-laws-sdk';

export function registerSubmitLaw(server: McpServer, api: MurphysLawsClient): void {
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
      const result = await api.submitLaw({ text, title, author, category_slug });

      if (result.kind === 'success') {
        const lines = [
          `Law submitted successfully! (ID: ${result.data.id})`,
          '',
          `Title: ${result.data.title || '(none)'}`,
          `Text: "${result.data.text}"`,
          `Author: ${author?.trim() || 'Anonymous'}`,
          `Category: ${category_slug || '(none)'}`,
          `Status: ${result.data.status}`,
          '',
          'The law is now in the review queue and will be published after manual approval.',
        ];
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      }

      if (result.kind === 'rate_limited') {
        return {
          content: [{ type: 'text' as const, text: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.` }],
          isError: true,
        };
      }

      if (result.kind === 'validation_error') {
        return {
          content: [{ type: 'text' as const, text: `Validation error: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Unexpected response (status ${result.status}).` }],
        isError: true,
      };
    },
  );
}
