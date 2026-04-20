import { formatLaw } from '../format.js';
import { UsageError } from '../parse-args.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runGet(ctx: CommandContext): Promise<CommandOutput> {
  const raw = ctx.args.positionals[0];
  if (!raw) {
    throw new UsageError('get requires a law id argument');
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UsageError(`get expects a positive integer id, got ${raw}`);
  }
  const law = await ctx.client.getLaw(id);
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(law, null, 2) };
  }
  return { exitCode: 0, stdout: formatLaw(law, ctx.colors) };
}
