import { formatLawList } from '../format.js';
import { parseIntOption, UsageError } from '../parse-args.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runCategory(ctx: CommandContext): Promise<CommandOutput> {
  const slug = ctx.args.positionals[0];
  if (!slug) {
    throw new UsageError('category requires a slug argument');
  }
  const limit = parseIntOption(ctx.args.options.limit, 'limit', { min: 1, max: 100 }) ?? 10;
  const offset = parseIntOption(ctx.args.options.offset, 'offset', { min: 0, max: 10000 });
  const result = await ctx.client.getLawsByCategory(slug, {
    limit,
    offset,
    sort: 'score',
    order: 'desc',
  });
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(result, null, 2) };
  }
  return { exitCode: 0, stdout: formatLawList(result.data, result.total, ctx.colors) };
}
