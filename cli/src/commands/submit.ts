import { UsageError } from '../parse-args.js';
import { EXIT_RATE_LIMITED, EXIT_USAGE } from '../exit-codes.js';
import type { CommandContext, CommandOutput } from './search.js';

export async function runSubmit(ctx: CommandContext): Promise<CommandOutput> {
  const text = ctx.args.options.text ?? ctx.args.positionals[0];
  if (!text) {
    throw new UsageError('submit requires law text (positional or --text)');
  }
  if (text.length < 10 || text.length > 1000) {
    throw new UsageError(`law text must be 10-1000 characters (got ${text.length})`);
  }

  const result = await ctx.client.submitLaw({
    text,
    title: ctx.args.options.title,
    author: ctx.args.options.author,
    category_slug: ctx.args.options.category,
  });

  if (ctx.json) {
    return {
      exitCode: exitCodeForResult(result.kind),
      stdout: JSON.stringify(result, null, 2),
    };
  }

  if (result.kind === 'success') {
    const lines = [
      ctx.colors.green(`Submitted law #${result.data.id} for review.`),
      `Title:    ${result.data.title || '(none)'}`,
      `Status:   ${result.data.status}`,
      `Category: ${ctx.args.options.category ?? '(none)'}`,
      `Author:   ${ctx.args.options.author ?? 'Anonymous'}`,
      '',
      ctx.colors.dim('Laws require manual approval before publication.'),
    ];
    return { exitCode: 0, stdout: lines.join('\n') };
  }

  if (result.kind === 'rate_limited') {
    return {
      exitCode: EXIT_RATE_LIMITED,
      stderr: ctx.colors.yellow(
        `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
      ),
    };
  }

  return {
    exitCode: EXIT_USAGE,
    stderr: ctx.colors.red(result.error),
  };
}

function exitCodeForResult(kind: 'success' | 'rate_limited' | 'validation_error' | 'unexpected_error'): number {
  switch (kind) {
    case 'success':
      return 0;
    case 'rate_limited':
      return EXIT_RATE_LIMITED;
    case 'validation_error':
    case 'unexpected_error':
      return EXIT_USAGE;
  }
}
