import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import { formatLaw, type LawData } from '../format.js';

interface LawOfDayResponse {
  law: LawData;
  featured_date: string;
}

export function registerGetLawOfTheDay(server: McpServer, api: ApiClient): void {
  server.tool(
    'get_law_of_the_day',
    "Get today's featured Murphy's Law. A new law is selected each day based on popularity.",
    {},
    async () => {
      try {
        const result = await api.get<LawOfDayResponse>('/api/v1/law-of-day');

        const text = `Law of the Day (${result.featured_date})\n\n${formatLaw(result.law)}`;

        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'No law of the day available.' }],
          isError: true,
        };
      }
    },
  );
}
