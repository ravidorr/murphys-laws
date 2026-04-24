/**
 * Export the design tokens defined by web/DESIGN.md (and its upstream source,
 * web/styles/partials/variables.css) into a Design Tokens Community Group
 * (DTCG) JSON file. The DTCG format is consumed by Figma Variables (via the
 * Tokens Studio plugin or Figma's native JSON import), Style Dictionary,
 * and most commercial design-to-code pipelines.
 *
 *   https://tr.designtokens.org/format/
 *
 * Output is a single JSON file. It is written to web/.design-exports/
 * (gitignored) so designers can import it on demand without polluting the
 * repo with a generated artifact. The script is intentionally NOT wired
 * into `ci:web`; DESIGN.md remains the single source of truth that CI
 * enforces. This is strictly an on-demand export.
 *
 * Reuses the parse + classify pipeline from sync-design-tokens.ts so the
 * export can never drift from what DESIGN.md publishes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCssVariables,
  classifyTokens,
  TYPOGRAPHY_LEVELS,
  ROUNDED_SCALE,
  COMPONENTS,
  type ClassifiedTokens,
  type TypographyLevel,
} from './sync-design-tokens.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VARIABLES_CSS_PATH = path.resolve(
  __dirname,
  '../styles/partials/variables.css',
);
const DEFAULT_OUTPUT_PATH = path.resolve(
  __dirname,
  '../.design-exports/design-tokens.dtcg.json',
);

export interface DtcgLeafToken {
  $value: string | number | Record<string, string | number>;
  $type: string;
  $description?: string;
}

export interface DtcgGroup {
  [key: string]: DtcgLeafToken | DtcgGroup;
}

export interface DtcgDocument {
  $schema: string;
  $description: string;
  color: DtcgGroup;
  dimension: DtcgGroup;
  typography: DtcgGroup;
  component: DtcgGroup;
}

/**
 * Build a DTCG-formatted document from the parsed design tokens and the
 * semantic levels (typography, radius, components) owned by the sync script.
 *
 * The shape follows the spec:
 *   - leaves carry both `$value` and `$type`
 *   - groups nest by category (color, dimension, typography, component)
 *   - token references use the dot path `{category.subgroup.name}` consistent
 *     with DESIGN.md's existing `{colors.foo}` / `{rounded.md}` / `{typography.body-md}` syntax
 *
 * Component entries are preserved as references (not resolved to concrete
 * values) so that consumers who import tokens into Figma Variables can wire
 * up component-level properties to the same base tokens.
 */
export function buildDtcgDocument(parsed: ClassifiedTokens): DtcgDocument {
  const color: DtcgGroup = {};
  for (const [name, hex] of parsed.colors) {
    color[name] = { $value: hex, $type: 'color' };
  }

  const spacing: DtcgGroup = {};
  for (const [name, dim] of parsed.spacing) {
    spacing[name] = { $value: dim, $type: 'dimension' };
  }

  const radius: DtcgGroup = {};
  for (const [name, dim] of Object.entries(ROUNDED_SCALE)) {
    radius[name] = { $value: dim, $type: 'dimension' };
  }

  const typography: DtcgGroup = {};
  for (const [level, props] of Object.entries(TYPOGRAPHY_LEVELS)) {
    typography[level] = buildTypographyLeaf(props);
  }

  const component: DtcgGroup = {};
  for (const [name, entries] of Object.entries(COMPONENTS)) {
    const group: DtcgGroup = {};
    for (const [prop, value] of Object.entries(entries)) {
      group[prop] = {
        $value: rewriteDesignMdRef(value),
        $type: inferDtcgType(prop, value),
      };
    }
    component[name] = group;
  }

  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description:
      "Murphy's Law Archive design tokens. Generated from web/DESIGN.md " +
      '(and the upstream web/styles/partials/variables.css) by ' +
      'web/scripts/export-design-tokens.ts. Do not hand-edit; re-run ' +
      '`npm --prefix web run design:export` to regenerate.',
    color,
    dimension: { spacing, radius },
    typography,
    component,
  };
}

function buildTypographyLeaf(props: TypographyLevel): DtcgLeafToken {
  const value: Record<string, string | number> = {
    fontFamily: props.fontFamily,
    fontSize: props.fontSize,
    fontWeight: props.fontWeight,
    lineHeight: props.lineHeight,
  };
  if (props.letterSpacing !== undefined) {
    value.letterSpacing = props.letterSpacing;
  }
  return { $value: value, $type: 'typography' };
}

/**
 * Translate DESIGN.md's `{colors.bg}` / `{rounded.md}` / `{typography.body-md}`
 * references into the DTCG path form this export uses.
 *
 * DESIGN.md lives in a flat namespace (colors, rounded, typography, spacing).
 * DTCG output nests `rounded` under `dimension.radius` and `spacing` under
 * `dimension.spacing`. We rewrite the prefix; the leaf name is unchanged.
 */
export function rewriteDesignMdRef(raw: string): string {
  const m = raw.match(/^\{([a-z]+)\.([a-z0-9-]+)\}$/i);
  if (!m) return raw;
  const category = m[1]!;
  const leaf = m[2]!;
  switch (category) {
    case 'colors':
      return `{color.${leaf}}`;
    case 'rounded':
      return `{dimension.radius.${leaf}}`;
    case 'spacing':
      return `{dimension.spacing.${leaf}}`;
    case 'typography':
      return `{typography.${leaf}}`;
    default:
      return raw;
  }
}

/**
 * Infer the DTCG `$type` for a component-level property. We key off the
 * property name rather than the value because components reference tokens
 * by path (`{colors.bg}`), not literals, so the value doesn't carry type
 * information by itself.
 */
export function inferDtcgType(prop: string, value: string): string {
  if (/color/i.test(prop)) return 'color';
  if (prop === 'rounded' || prop === 'radius') return 'dimension';
  if (prop === 'typography') return 'typography';
  if (prop === 'width' || prop === 'height' || /size|spacing/i.test(prop)) {
    return 'dimension';
  }
  if (value.startsWith('{')) return 'other';
  return 'other';
}

export interface ExportRunOptions {
  variablesCssPath: string;
  outputPath: string;
  readFile: (p: string) => string;
  existsFile: (p: string) => boolean;
  mkdirp: (p: string) => void;
  writeFile: (p: string, contents: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function runExport(options: ExportRunOptions): 0 | 1 {
  if (!options.existsFile(options.variablesCssPath)) {
    options.logger.error(
      `design tokens export: ${options.variablesCssPath} not found.`,
    );
    return 1;
  }
  const css = options.readFile(options.variablesCssPath);
  const parsed = classifyTokens(parseCssVariables(css));
  const doc = buildDtcgDocument(parsed);
  const serialized = JSON.stringify(doc, null, 2) + '\n';
  options.mkdirp(path.dirname(options.outputPath));
  options.writeFile(options.outputPath, serialized);
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

if (isMain()) {
  const code = runExport({
    variablesCssPath: VARIABLES_CSS_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    existsFile: (p) => fs.existsSync(p),
    mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
    writeFile: (p, c) => fs.writeFileSync(p, c, 'utf8'),
    logger: console,
  });
  process.exit(code);
}
