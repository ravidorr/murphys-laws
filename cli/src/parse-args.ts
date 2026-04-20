export interface GlobalFlags {
  json: boolean;
  color: boolean;
  baseUrl: string | undefined;
  userAgent: string | undefined;
  help: boolean;
  version: boolean;
}

export interface ParsedArgs {
  flags: GlobalFlags;
  command: string | undefined;
  positionals: string[];
  options: Record<string, string>;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

const GLOBAL_VALUE_FLAGS = new Set(['--base-url', '--user-agent']);
const GLOBAL_BOOL_FLAGS = new Set([
  '--json',
  '--no-color',
  '--color',
  '--help',
  '-h',
  '--version',
  '-v',
]);

export const COMMAND_VALUE_FLAGS = new Set([
  '--limit',
  '--offset',
  '--category',
  '--title',
  '--author',
  '--text',
  '--sort',
  '--order',
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: GlobalFlags = {
    json: false,
    color: true,
    baseUrl: undefined,
    userAgent: undefined,
    help: false,
    version: false,
  };
  const positionals: string[] = [];
  const options: Record<string, string> = {};
  let command: string | undefined;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg === '--json') {
      flags.json = true;
      i++;
      continue;
    }

    if (arg === '--no-color') {
      flags.color = false;
      i++;
      continue;
    }

    if (arg === '--color') {
      flags.color = true;
      i++;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      i++;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      flags.version = true;
      i++;
      continue;
    }

    if (arg === '--base-url' || arg === '--user-agent') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new UsageError(`Missing value for ${arg}`);
      }
      if (arg === '--base-url') flags.baseUrl = value;
      else flags.userAgent = value;
      i += 2;
      continue;
    }

    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      const key = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      if (GLOBAL_BOOL_FLAGS.has(key)) {
        throw new UsageError(`Flag ${key} does not take a value`);
      }
      if (GLOBAL_VALUE_FLAGS.has(key)) {
        if (key === '--base-url') flags.baseUrl = value;
        else flags.userAgent = value;
        i++;
        continue;
      }
      if (COMMAND_VALUE_FLAGS.has(key)) {
        options[key.slice(2)] = value;
        i++;
        continue;
      }
      throw new UsageError(`Unknown flag: ${key}`);
    }

    if (COMMAND_VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new UsageError(`Missing value for ${arg}`);
      }
      options[arg.slice(2)] = value;
      i += 2;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new UsageError(`Unknown flag: ${arg}`);
    }

    if (command === undefined) {
      command = arg;
    } else {
      positionals.push(arg);
    }
    i++;
  }

  return { flags, command, positionals, options };
}

export function parseIntOption(
  raw: string | undefined,
  name: string,
  { min, max }: { min: number; max: number },
): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new UsageError(`Invalid value for --${name}: ${raw} (expected integer ${min}-${max})`);
  }
  return n;
}
