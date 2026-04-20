export interface Colorize {
  bold(s: string): string;
  dim(s: string): string;
  cyan(s: string): string;
  yellow(s: string): string;
  red(s: string): string;
  green(s: string): string;
  gray(s: string): string;
}

const RESET = '\u001b[0m';

function wrap(open: string): (s: string) => string {
  return (s: string): string => `${open}${s}${RESET}`;
}

const ANSI: Colorize = {
  bold: wrap('\u001b[1m'),
  dim: wrap('\u001b[2m'),
  cyan: wrap('\u001b[36m'),
  yellow: wrap('\u001b[33m'),
  red: wrap('\u001b[31m'),
  green: wrap('\u001b[32m'),
  gray: wrap('\u001b[90m'),
};

const PLAIN: Colorize = {
  bold: (s) => s,
  dim: (s) => s,
  cyan: (s) => s,
  yellow: (s) => s,
  red: (s) => s,
  green: (s) => s,
  gray: (s) => s,
};

export interface ColorOptions {
  colorFlag: boolean;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
}

export function selectColors({ colorFlag, isTTY, env }: ColorOptions): Colorize {
  if (!colorFlag) return PLAIN;
  if (env.NO_COLOR !== undefined) return PLAIN;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return ANSI;
  if (!isTTY) return PLAIN;
  return ANSI;
}
