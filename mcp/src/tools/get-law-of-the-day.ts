import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError, type MurphysLawsClient } from 'murphys-laws-sdk';
import { formatLaw } from '../format.js';

export function registerGetLawOfTheDay(server: McpServer, api: MurphysLawsClient): void {
  server.tool(
    'get_law_of_the_day',
    "Get today's featured Murphy's Law. A new law is selected each day based on popularity.",
    {},
    async () => {
      try {
        const result = await api.getLawOfTheDay();

        const text = `Law of the Day (${result.featured_date})\n\n${formatLaw(result.law)}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return {
            content: [{ type: 'text' as const, text: 'No law of the day available.' }],
            isError: true,
          };
        }
        throw err;
      }
    },
  );
}
