import { ApiError, MurphysLawsClient } from 'murphys-laws-sdk';
import { selectColors } from './colors.js';
import {
  EXIT_NETWORK,
  EXIT_NOT_FOUND,
  EXIT_RATE_LIMITED,
  EXIT_SUCCESS,
  EXIT_USAGE,
  type ExitCode,
} from './exit-codes.js';
import { HELP_TEXT } from './help.js';
import { parseArgs, UsageError } from './parse-args.js';
import { runCategories } from './commands/categories.js';
import { runCategory } from './commands/category.js';
import { runGet } from './commands/get.js';
import { runRandom } from './commands/random.js';
import { runSearch, type CommandContext, type CommandOutput } from './commands/search.js';
import { runSubmit } from './commands/submit.js';
import { runToday } from './commands/today.js';

export interface Deps {
  stdout: { write(s: string): boolean };
  stderr: { write(s: string): boolean };
  env: NodeJS.ProcessEnv;
  isStdoutTTY: boolean;
  version: string;
  clientFactory?: (opts: { baseUrl?: string; userAgent?: string }) => MurphysLawsClient;
}

const COMMANDS: Record<string, (ctx: CommandContext) => Promise<CommandOutput>> = {
  search: runSearch,
  random: runRandom,
  today: runToday,
  get: runGet,
  categories: runCategories,
  category: runCategory,
  submit: runSubmit,
};

export async function runCli(argv: string[], deps: Deps): Promise<ExitCode> {
  try {
    const args = parseArgs(argv);

    if (args.flags.version) {
      deps.stdout.write(`${deps.version}\n`);
      return EXIT_SUCCESS;
    }

    if (args.flags.help || args.command === undefined || args.command === 'help') {
      deps.stdout.write(HELP_TEXT);
      return args.command === undefined && !args.flags.help ? EXIT_USAGE : EXIT_SUCCESS;
    }

    const handler = COMMANDS[args.command];
    if (!handler) {
      deps.stderr.write(`Unknown command: ${args.command}\n`);
      deps.stderr.write(`Run 'murphy --help' for usage.\n`);
      return EXIT_USAGE;
    }

    const factory = deps.clientFactory ?? defaultClientFactory;
    const client = factory({
      baseUrl: args.flags.baseUrl,
      userAgent: args.flags.userAgent ?? `murphys-laws-cli/${deps.version}`,
    });
    const colors = selectColors({
      colorFlag: args.flags.color,
      isTTY: deps.isStdoutTTY,
      env: deps.env,
    });

    const ctx: CommandContext = { args, client, colors, json: args.flags.json };
    const result = await handler(ctx);
    if (result.stdout !== undefined) deps.stdout.write(`${result.stdout}\n`);
    if (result.stderr !== undefined) deps.stderr.write(`${result.stderr}\n`);
    return result.exitCode as ExitCode;
  } catch (err) {
    return handleError(err, deps);
  }
}

function defaultClientFactory(opts: { baseUrl?: string; userAgent?: string }): MurphysLawsClient {
  return new MurphysLawsClient(opts);
}

function handleError(err: unknown, deps: Deps): ExitCode {
  if (err instanceof UsageError) {
    deps.stderr.write(`${err.message}\n`);
    deps.stderr.write(`Run 'murphy --help' for usage.\n`);
    return EXIT_USAGE;
  }
  if (err instanceof ApiError) {
    if (err.status === 404) {
      deps.stderr.write(`Not found.\n`);
      return EXIT_NOT_FOUND;
    }
    if (err.status === 429) {
      deps.stderr.write(`Rate limit exceeded.\n`);
      return EXIT_RATE_LIMITED;
    }
    deps.stderr.write(`API error ${err.status}: ${err.body}\n`);
    return EXIT_NETWORK;
  }
  const message = err instanceof Error ? err.message : String(err);
  deps.stderr.write(`Error: ${message}\n`);
  return EXIT_NETWORK;
}
