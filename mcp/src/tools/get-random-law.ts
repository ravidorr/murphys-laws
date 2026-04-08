import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LawService } from '../../../backend/src/services/laws.service.ts';
import { formatLaw } from '../format.ts';

export function registerGetRandomLaw(server: McpServer, lawService: LawService): void {
  server.tool(
    'get_random_law',
    "Get a random Murphy's Law. Great for adding humor to conversations or discovering new laws.",
    {},
    async () => {
      const law = await lawService.getRandomLaw();

      if (!law) {
        return {
          content: [{ type: 'text' as const, text: 'No laws found in the database.' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: formatLaw(law) }],
      };
    },
  );
}
