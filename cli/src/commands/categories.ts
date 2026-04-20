import { formatCategories } from '../format.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runCategories(ctx: CommandContext): Promise<CommandOutput> {
  const categories = await ctx.client.listCategories();
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(categories, null, 2) };
  }
  return { exitCode: 0, stdout: formatCategories(categories, ctx.colors) };
}
