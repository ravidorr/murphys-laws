import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import { formatLaw } from '../format.ts';

export function registerGetLaw(server: McpServer, lawService: LawService): void {
  server.tool(
    'get_law',
    "Get a specific Murphy's Law by its ID. Use this to look up a law found in search results.",
    {
      law_id: z.number().int().positive().describe('The ID of the law to retrieve'),
    },
    async ({ law_id }) => {
      const law = await lawService.getLaw(law_id);

      if (!law) {
        return {
          content: [{ type: 'text' as const, text: `Law #${law_id} not found.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: formatLaw(law) }],
      };
    },
  );
}
