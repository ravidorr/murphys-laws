import { formatLaw } from '../format.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runToday(ctx: CommandContext): Promise<CommandOutput> {
  const result = await ctx.client.getLawOfTheDay();
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(result, null, 2) };
  }
  const header = `${ctx.colors.cyan('Law of the Day')} (${result.featured_date})`;
  return { exitCode: 0, stdout: `${header}\n\n${formatLaw(result.law, ctx.colors)}` };
}
