import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import { ApiError } from '../api-client.js';
import { formatLaw, type LawData } from '../format.js';

export function registerGetRandomLaw(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_random_law',
    "Get a random Murphy's Law. Great for adding humor to conversations or discovering new laws.",
    {},
    async () => {
      try {
        const law = await api.get<LawData>('/api/v1/laws/random');

        return {
          content: [{ type: 'text' as const, text: formatLaw(law) }],
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return {
            content: [{ type: 'text' as const, text: 'No laws found in the database.' }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );
}
