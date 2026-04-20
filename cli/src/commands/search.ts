import type { MurphysLawsClient } from 'murphys-laws-sdk';
import type { Colorize } from '../colors.js';
import { formatLawList } from '../format.js';
import { parseIntOption, UsageError, type ParsedArgs } from '../parse-args.js';

export interface CommandContext {
  args: ParsedArgs;
  client: MurphysLawsClient;
  colors: Colorize;
  json: boolean;
}

export interface CommandOutput {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export async function runSearch(ctx: CommandContext): Promise<CommandOutput> {
  const query = ctx.args.positionals[0];
  if (!query) {
    throw new UsageError('search requires a query argument');
  }
  const limit = parseIntOption(ctx.args.options.limit, 'limit', { min: 1, max: 100 }) ?? 10;
  const offset = parseIntOption(ctx.args.options.offset, 'offset', { min: 0, max: 10000 });
  const result = await ctx.client.searchLaws({
    q: query,
    limit,
    offset,
    category_slug: ctx.args.options.category,
    sort: 'score',
    order: 'desc',
  });
  if (ctx.json) {
    return { exitCode: 0, stdout: JSON.stringify(result, null, 2) };
  }
  return { exitCode: 0, stdout: formatLawList(result.data, result.total, ctx.colors) };
}
