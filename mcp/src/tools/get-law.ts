import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError, type MurphysLawsClient } from 'murphys-laws-sdk';
import { formatLaw } from '../format.js';

export function registerGetLaw(server: McpServer, api: MurphysLawsClient): void {
  server.tool(
    'get_law',
    "Get a specific Murphy's Law by its ID. Use this to look up a law found in search results.",
    {
      law_id: z.number().int().positive().describe('The ID of the law to retrieve'),
    },
    async ({ law_id }) => {
      try {
        const law = await api.getLaw(law_id);

        return {
          content: [{ type: 'text' as const, text: formatLaw(law) }],
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return {
            content: [{ type: 'text' as const, text: `Law #${law_id} not found.` }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );
}
