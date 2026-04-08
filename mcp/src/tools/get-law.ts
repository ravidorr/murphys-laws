import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import { ApiError } from '../api-client.js';
import { formatLaw, type LawData } from '../format.js';

export function registerGetLaw(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_law',
    "Get a specific Murphy's Law by its ID. Use this to look up a law found in search results.",
    {
      law_id: z.number().int().positive().describe('The ID of the law to retrieve'),
    },
    async ({ law_id }) => {
      try {
        const law = await api.get<LawData>(`/api/v1/laws/${law_id}`);

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
