import { formatLaw } from '../format.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runRandom(ctx: CommandContext): Promise<CommandOutput> {
  const law = await ctx.client.getRandomLaw();
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(law, null, 2) };
  }
  return { exitCode: 0, stdout: formatLaw(law, ctx.colors) };
}
