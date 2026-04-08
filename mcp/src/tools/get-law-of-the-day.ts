import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import { formatLaw } from '../format.ts';

export function registerGetLawOfTheDay(server: McpServer, lawService: LawService): void {
  server.tool(
    'get_law_of_the_day',
    "Get today's featured Murphy's Law. A new law is selected each day based on popularity.",
    {},
    async () => {
      const result = await lawService.getLawOfTheDay();

      if (!result) {
        return {
          content: [{ type: 'text' as const, text: 'No law of the day available.' }],
          isError: true,
        };
      }

      const text = `Law of the Day (${result.featured_date})\n\n${formatLaw(result.law)}`;

      return {
        content: [{ type: 'text' as const, text }],
      };
    },
  );
}
