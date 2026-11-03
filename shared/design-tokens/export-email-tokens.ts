/**
 * Export the few design tokens the subscription emails use as literal values.
 *
 * Email clients ignore stylesheets and CSS variables, so shared/modules/email-layout.ts needs the colors as
 * plain hex strings. This generator reads web/styles/partials/variables.css (the authoritative token values)
 * and writes shared/modules/email-tokens.generated.ts, so the emails never keep a hand-maintained copy.
 *
 * Modes:
 *   <no flag>  : write the file
 *   --check    : fail when the committed file differs from what variables.css would generate
 *                (part of `npm run design:check`)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyTokens, parseCssVariables } from './sync-design-tokens.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VARIABLES_CSS_PATH = path.resolve(__dirname, '../../web/styles/partials/variables.css');
const OUTPUT_PATH = path.resolve(__dirname, '../modules/email-tokens.generated.ts');

/** Tokens the emails render with, by their name in variables.css. */
export const EMAIL_TOKEN_NAMES = [
  'bg',
  'fg',
  'muted-fg',
  'primary',
  'surface-border',
  'link',
  'btn-primary-bg',
  'btn-primary-fg',
  'white',
  'dark-bg-primary',
  'dark-fg-primary',
  'dark-muted-fg',
  'dark-primary',
  'dark-surface-border',
  'dark-link',
] as const;

/** The generated module's source, or throws when variables.css lacks one of the tokens. */
export function buildEmailTokensSource(css: string): string {
  const { colors } = classifyTokens(parseCssVariables(css));
  const lines = EMAIL_TOKEN_NAMES.map((name) => {
    const value = colors.get(name);
    if (value === undefined) {
      throw new Error(`Email token --${name} is not a literal color in variables.css`);
    }
    return `  '${name}': '${value.toLowerCase()}',`;
  });
  return `/**
 * Generated from web/styles/partials/variables.css by shared/design-tokens/export-email-tokens.ts.
 * Do not edit by hand; run \`npm run design:export:email\`.
 */
export const EMAIL_TOKENS = {
${lines.join('\n')}
} as const;
`;
}

export interface EmailExportOptions {
  check: boolean;
  variablesCssPath: string;
  outputPath: string;
  readFile: (p: string) => string;
  existsFile: (p: string) => boolean;
  writeFile: (p: string, contents: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function runEmailExport(options: EmailExportOptions): 0 | 1 {
  const next = buildEmailTokensSource(options.readFile(options.variablesCssPath));
  const existing = options.existsFile(options.outputPath) ? options.readFile(options.outputPath) : undefined;

  if (options.check) {
    if (existing !== next) {
      options.logger.error(
        'Email tokens are out of sync with web/styles/partials/variables.css. Run: npm run design:export:email',
      );
      return 1;
    }
    options.logger.log('Email tokens are in sync with variables.css.');
    return 0;
  }

  options.writeFile(options.outputPath, next);
  options.logger.log(`Wrote ${options.outputPath}`);
  return 0;
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === new URL(`file://${entry}`).href;
  } catch {
    return false;
  }
}

/* v8 ignore start -- CLI entry point, covered by `npm run design:check` */
if (isMain()) {
  process.exit(
    runEmailExport({
      check: process.argv.includes('--check'),
      variablesCssPath: VARIABLES_CSS_PATH,
      outputPath: OUTPUT_PATH,
      readFile: (p) => fs.readFileSync(p, 'utf8'),
      existsFile: (p) => fs.existsSync(p),
      writeFile: (p, c) => fs.writeFileSync(p, c, 'utf8'),
      logger: console,
    }),
  );
}
/* v8 ignore stop */
