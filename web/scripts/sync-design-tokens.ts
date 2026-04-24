/**
 * Sync web/DESIGN.md YAML front matter from web/styles/partials/variables.css.
 *
 * variables.css is the source of truth for concrete color / spacing values.
 * DESIGN.md is a derived artifact whose YAML front matter mirrors those
 * tokens for AI agents, Figma, Stitch, and any other DESIGN.md consumer.
 *
 * The markdown body of DESIGN.md is authored and is preserved verbatim;
 * typography / components / rounded blocks are semantic and are owned by
 * this script (they do not appear in variables.css as atomic primitives).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VARIABLES_CSS_PATH = path.resolve(
  __dirname,
  '../styles/partials/variables.css',
);
const DESIGN_MD_PATH = path.resolve(__dirname, '../DESIGN.md');

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SPACING_KEY_RE = /^space-(\d+)$/;

export interface ClassifiedTokens {
  colors: Map<string, string>;
  spacing: Map<string, string>;
}

/**
 * Parse a `:root { ... }` block out of a CSS source and return a
 * Map of custom-property name (without the leading `--`) to raw value.
 */
export function parseCssVariables(cssContent: string): Map<string, string> {
  const vars = new Map<string, string>();
  const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch || rootMatch[1] === undefined) {
    return vars;
  }
  const body = rootMatch[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const decl = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(body)) !== null) {
    const name = m[1];
    const rawValue = m[2];
    if (name === undefined || rawValue === undefined) continue;
    vars.set(name, rawValue.trim());
  }
  return vars;
}

/**
 * Split the parsed CSS variables into DESIGN.md-safe buckets.
 *
 * - colors: any variable whose value is a literal hex color (SRGB).
 *   Alpha (`rgb()` / `rgba()`) and runtime values (`color-mix(...)`,
 *   `var(--other)`) are intentionally excluded - DESIGN.md only allows
 *   `#HEX` in the YAML front matter and agents would otherwise see
 *   broken token values.
 * - spacing: any variable named `space-N`, emitted as a `Npx` Dimension.
 *   Input is expected in rem (matching the Tailwind-style 1rem = 16px
 *   convention used in variables.css).
 */
export function classifyTokens(
  vars: Map<string, string>,
): ClassifiedTokens {
  const colors = new Map<string, string>();
  const spacing = new Map<string, string>();

  for (const [name, value] of vars) {
    const spaceMatch = name.match(SPACING_KEY_RE);
    if (spaceMatch && spaceMatch[1] !== undefined) {
      const px = remOrPxToPx(value);
      if (px !== null) {
        spacing.set(spaceMatch[1], `${px}px`);
      }
      continue;
    }
    const normalized = normalizeHex(value);
    if (normalized !== null) {
      colors.set(name, normalized);
    }
  }

  return { colors, spacing };
}

function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    return null;
  }
  // Expand shorthand #abc / #abcd to 6/8-digit form for consistency.
  const hex = trimmed.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return '#' + hex.split('').map((c) => c + c).join('').toLowerCase();
  }
  return '#' + hex.toLowerCase();
}

function remOrPxToPx(raw: string): number | null {
  const trimmed = raw.trim();
  const remMatch = trimmed.match(/^([\d.]+)rem$/);
  if (remMatch && remMatch[1] !== undefined) {
    return Math.round(parseFloat(remMatch[1]) * 16);
  }
  const pxMatch = trimmed.match(/^([\d.]+)px$/);
  if (pxMatch && pxMatch[1] !== undefined) {
    return Math.round(parseFloat(pxMatch[1]));
  }
  return null;
}

/**
 * Typography levels for DESIGN.md. The web codebase does not tokenize
 * semantic levels in CSS (it ships atomic --text-* / --font-* /
 * --leading-* primitives and composes them in each component), so the
 * mapping from primitives to semantic levels lives here.
 *
 * Keep this in sync with web/styles/partials/base.css and components.css.
 */
const TYPOGRAPHY_LEVELS: Record<
  string,
  {
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number | string;
    letterSpacing?: string;
  }
> = {
  display: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '48px',
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  h1: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1.25,
  },
  h2: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '30px',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  h3: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.375,
  },
  h4: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.375,
  },
  'body-lg': {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '18px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  'body-md': {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  'body-sm': {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontFamily: 'Work Sans, system-ui',
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: 1.25,
  },
};

/**
 * Corner-radius scale. Derived from observed border-radius values in
 * components.css and calculator.css; not currently tokenized in CSS.
 */
const ROUNDED_SCALE: Record<string, string> = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

/**
 * Component contracts. Each entry references color tokens from the
 * generated `colors` block via DESIGN.md's `{path.to.token}` syntax.
 * Keep this aligned with web/styles/partials/components.css and theme.css.
 */
const COMPONENTS: Record<string, Record<string, string>> = {
  'btn-primary': {
    backgroundColor: '{colors.btn-primary-bg}',
    textColor: '{colors.btn-primary-fg}',
    rounded: '{rounded.md}',
    typography: '{typography.body-md}',
  },
  'btn-outline': {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.md}',
    typography: '{typography.body-md}',
  },
  card: {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.lg}',
  },
  'section-card': {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.lg}',
  },
  input: {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.sm}',
    typography: '{typography.body-md}',
  },
  modal: {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.lg}',
  },
  'nav-dropdown': {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.md}',
  },
  'brand-badge': {
    backgroundColor: '{colors.primary}',
    textColor: '{colors.white}',
    rounded: '{rounded.full}',
  },
  blockquote: {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
  },
  pagination: {
    backgroundColor: '{colors.bg}',
    textColor: '{colors.fg}',
    rounded: '{rounded.md}',
  },
  'calc-ok': {
    backgroundColor: '{colors.success-bg}',
    textColor: '{colors.success-text}',
  },
  'calc-warn': {
    backgroundColor: '{colors.warning-bg}',
    textColor: '{colors.warning-text}',
  },
  'calc-orange': {
    backgroundColor: '{colors.orange-bg}',
    textColor: '{colors.orange-text}',
  },
  'calc-danger': {
    backgroundColor: '{colors.error-bg}',
    textColor: '{colors.error-text}',
  },
  'calc-dark': {
    backgroundColor: '{colors.dark-bg}',
    textColor: '{colors.dark-text}',
  },
  rank: {
    textColor: '{colors.text-high-contrast}',
    typography: '{typography.body-md}',
    width: '24px',
  },
};

const NAME = "Murphy's Law Archive";
const VERSION = 'alpha';
const DESCRIPTION =
  'Design tokens and component contracts for murphys-laws.com. Derived from web/styles/partials/variables.css; the Markdown body below is authored.';

const COLOR_KEY_ORDER = [
  // Core light-mode
  'bg',
  'fg',
  'muted-fg',
  'primary',
  'text-high-contrast',
  'btn-primary-bg',
  'btn-primary-fg',
  // Semantic: success
  'success',
  'success-bg',
  'success-border',
  'success-text',
  'success-dark',
  // Semantic: error
  'error',
  'error-bg',
  'error-border',
  'error-text',
  'error-dark',
  // Semantic: favorite
  'favorite-color',
  'favorite-bg',
  'favorite-border',
  // Semantic: warning
  'warning-bg',
  'warning-text',
  // Semantic: orange
  'orange-bg',
  'orange-text',
  // Semantic: "dark" (distinct from dark mode: dark emphasis state)
  'dark-bg',
  'dark-text',
  // Semantic: important
  'important',
  // UI
  'white',
  'highlight',
  // Gradient
  'gradient-blue',
  'gradient-dark-1',
  'gradient-dark-2',
  // Dark-mode counterparts
  'dark-bg-primary',
  'dark-fg-primary',
  'dark-muted-fg',
  'dark-primary',
  'dark-text-high-contrast',
  'dark-link',
  'dark-link-visited',
  'dark-link-hover',
  'dark-success-bg',
  'dark-success-fg',
  'dark-warning-bg',
  'dark-warning-fg',
  'dark-orange-bg',
  'dark-orange-fg',
  'dark-error-bg',
  'dark-error-fg',
  'dark-dark-bg',
  'dark-dark-fg',
  'dark-favorite-color',
  'dark-favorite-bg',
];

const SPACING_KEY_ORDER = ['1', '2', '3', '4', '5', '6', '8', '10', '12', '16'];

function quoteYamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function renderFrontMatter(parsed: ClassifiedTokens): string {
  const lines: string[] = [];
  lines.push(`version: ${VERSION}`);
  lines.push(`name: ${yamlString(NAME)}`);
  lines.push(`description: ${yamlString(DESCRIPTION)}`);

  lines.push('colors:');
  const seenColorKeys = new Set<string>();
  for (const key of COLOR_KEY_ORDER) {
    const value = parsed.colors.get(key);
    if (value !== undefined) {
      lines.push(`  ${quoteYamlKey(key)}: ${yamlString(value)}`);
      seenColorKeys.add(key);
    }
  }
  // Trailing tokens the author added to variables.css after the ordered list.
  const extraColors = [...parsed.colors.keys()]
    .filter((k) => !seenColorKeys.has(k))
    .sort();
  for (const key of extraColors) {
    lines.push(`  ${quoteYamlKey(key)}: ${yamlString(parsed.colors.get(key)!)}`);
  }

  lines.push('typography:');
  for (const [level, props] of Object.entries(TYPOGRAPHY_LEVELS)) {
    lines.push(`  ${quoteYamlKey(level)}:`);
    lines.push(`    fontFamily: ${yamlString(props.fontFamily)}`);
    lines.push(`    fontSize: ${yamlString(props.fontSize)}`);
    lines.push(`    fontWeight: ${props.fontWeight}`);
    lines.push(`    lineHeight: ${props.lineHeight}`);
    if (props.letterSpacing !== undefined) {
      lines.push(`    letterSpacing: ${yamlString(props.letterSpacing)}`);
    }
  }

  lines.push('rounded:');
  for (const [level, dim] of Object.entries(ROUNDED_SCALE)) {
    lines.push(`  ${quoteYamlKey(level)}: ${yamlString(dim)}`);
  }

  lines.push('spacing:');
  const seenSpacingKeys = new Set<string>();
  for (const key of SPACING_KEY_ORDER) {
    const value = parsed.spacing.get(key);
    if (value !== undefined) {
      lines.push(`  ${quoteYamlKey(key)}: ${yamlString(value)}`);
      seenSpacingKeys.add(key);
    }
  }
  const extraSpacing = [...parsed.spacing.keys()]
    .filter((k) => !seenSpacingKeys.has(k))
    .sort((a, b) => Number(a) - Number(b));
  for (const key of extraSpacing) {
    lines.push(`  ${quoteYamlKey(key)}: ${yamlString(parsed.spacing.get(key)!)}`);
  }

  lines.push('components:');
  for (const [name, props] of Object.entries(COMPONENTS)) {
    lines.push(`  ${quoteYamlKey(name)}:`);
    for (const [prop, value] of Object.entries(props)) {
      lines.push(`    ${quoteYamlKey(prop)}: ${yamlString(value)}`);
    }
  }

  return lines.join('\n') + '\n';
}

const DEFAULT_BODY = `# Murphy's Law Archive - Design System

## Overview

Murphy's Law Archive is an archive, not an app. The product celebrates
the history of a truism; the visual system should feel like a tidy
reference work with a dry sense of humor rather than a trendy SaaS
dashboard. Typography carries most of the personality; chrome stays
quiet. Color is used to reinforce meaning (success, error, favorite,
calculator state) and almost never for decoration.

Tone: archive, academic, dry humor. Density: comfortable but not airy.
Accessibility is non-negotiable; the token values in this file are tuned
for WCAG 2.1 AA contrast in both light and dark modes.

## Colors

The palette is neutral-first. A single deep blue carries interaction.
Semantic palettes (success, error, warning, orange, dark, favorite)
are used by the calculators and form feedback surfaces. All light-mode
tokens are paired with a dark-mode counterpart (prefixed \`dark-\`)
activated via \`prefers-color-scheme: dark\` or \`:root[data-theme="dark"]\`.

- Neutral surfaces: \`bg\`, \`fg\`, \`muted-fg\`, \`text-high-contrast\`.
- Brand: \`primary\` for brand badge, \`btn-primary-bg\` / \`btn-primary-fg\`
  for primary calls-to-action. \`btn-primary-bg\` is tuned darker than a
  default Tailwind blue to pass WCAG AA on white.
- Semantic: \`success\`, \`error\`, \`favorite-color\`, \`important\`, plus
  paired \`-bg\` / \`-text\` / \`-border\` tokens for badges and callouts.
- Calculator states: \`calc-ok\` / \`calc-warn\` / \`calc-orange\` / \`calc-danger\`
  / \`calc-dark\` map to the semantic palette.

Tokens that rely on runtime alpha or \`color-mix()\` (borders, shadows,
hover layers) are intentionally not represented as YAML tokens because
DESIGN.md requires literal \`#HEX\` values. Treat them as implementation
details of the CSS, not as part of the design contract. See
\`web/styles/partials/variables.css\` and \`theme.css\` for the actual
definitions.

## Typography

The web uses a single family, **Work Sans**, with a system-font fallback
stack. The type scale is a Major Third (1.25) progression from 12 px
caption to 48 px display. Weights run 400 / 500 / 600 / 700 / 800;
600 is the default for headings. Line heights are tight on display
copy (1.1-1.25) and relaxed on body (1.5).

The \`typography\` tokens in the YAML front matter are semantic levels
(\`display\`, \`h1\`..\`h4\`, \`body-lg\`..\`body-sm\`, \`caption\`) composed
from the atomic \`--text-*\`, \`--font-*\`, and \`--leading-*\` primitives
in \`variables.css\`.

## Layout

Spacing follows a 4 px base unit: \`space-1\` (4 px) through \`space-16\`
(64 px). The scale is not linear - it skips through Fibonacci-adjacent
steps (1, 2, 3, 4, 5, 6, 8, 10, 12, 16) to keep composition rhythmic.

Layouts are content-first, single-column on mobile, with a centered
max-width on desktop. The header uses a sticky translucent surface
(\`color-mix\` over \`bg\`); the footer uses a lightly tinted surface
(\`color-mix\` over \`bg\` at ~90%).

## Elevation & Depth

Elevation is the combination of a \`color-mix\` surface tint and a
stacked \`box-shadow\` (inset highlight plus outer drop). It is not
tokenized; the three tiers below live directly in
\`web/styles/partials/theme.css\` and \`components.css\`, not in YAML:

- Resting cards: subtle ~8 px blur at low alpha over a lightly tinted
  surface (\`color-mix(in oklab, var(--bg) 88%, white 12%)\` in dark
  mode, \`var(--bg)\` in light mode).
- Floating surfaces (dropdowns, modals): 20-24 px blur at higher alpha
  over the same tinted surface, with a 1 px inset highlight.
- High-contrast mode: elevations collapse to 2 px solid borders via
  \`prefers-contrast: more\` or \`:root[data-contrast="more"]\`; shadows
  are effectively dropped.

## Shapes

Corner radii use a five-level scale, exposed as the \`rounded\` tokens
in the YAML front matter: \`sm\` 4 px, \`md\` 6 px, \`lg\` 8 px, \`xl\` 12 px,
\`full\` 9999 px (pill). Buttons use \`md\`, cards and modals use \`lg\`,
the brand badge uses \`full\`. There is no "none" level: zero radius is
a deliberate choice, not a token.

## Components

The \`components\` section in the YAML front matter assigns color and
shape tokens to the core shipped components. It is not exhaustive - it
covers the primitives that agents most often need to reproduce
(buttons, cards, inputs, modal, brand badge, blockquote, pagination,
and the calculator state pills). Dark-mode overrides are handled in
\`theme.css\`; agents should assume any component is theme-aware and
use the \`dark-*\` color tokens for dark surfaces.

## Do's and Don'ts

- Do keep type doing the heavy lifting. Chrome should be quiet.
- Do use semantic color tokens (\`success-*\`, \`error-*\`, etc.) - never
  raw hex in components.
- Do keep contrast at WCAG AA or better. The token values already pass;
  reach for them, not "close enough" shades.
- Don't introduce Material Design 3 components or styles. Stitch will
  default to MD3; steer it with this DESIGN.md and discard MD3-specific
  output.
- Don't ship emojis in UI copy - ESLint and markdownlint both reject
  them repo-wide.
- Don't use inline styles. \`html-validate\` blocks them; put styles in
  the relevant partial under \`web/styles/partials/\`.
- Don't edit the YAML front matter by hand. It is regenerated from
  \`variables.css\` by \`npm run design:sync\` in the \`web\` workspace.

## Workflow

This DESIGN.md is the single source of truth for agents (Cursor,
Claude, Stitch, Figma). The authoritative values live in
\`web/styles/partials/variables.css\`. The sync script
\`web/scripts/sync-design-tokens.ts\` parses that file and regenerates
the YAML front matter above; it does not touch this Markdown body.

- **Change a color or spacing value:** edit \`variables.css\`, then run
  \`npm --prefix web run design:sync\`. CI enforces no drift via
  \`npm run design:check\` in \`ci:web\`.
- **Change a typography level, component contract, or radius scale:**
  edit the constants at the top of \`sync-design-tokens.ts\` and re-run
  \`design:sync\`. These are semantic decisions that do not have a 1:1
  representation in CSS.
- **Use Stitch for ideation:** seed Stitch with this file. Keep
  generated mockups in \`web/.stitch/\` (gitignored). Do not ship
  Stitch-generated HTML/CSS; translate mockups by hand into the
  vanilla-TS components under \`web/src/components/\`.
- **Validate:** \`npm --prefix web run design:check\` runs
  \`design:sync --check\` for drift and \`@google/design.md lint\` for
  structural correctness and WCAG contrast.
`;

export interface BuildInput {
  existingContent?: string | undefined;
  parsed: ClassifiedTokens;
}

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function extractBody(existingContent: string | undefined): string {
  if (existingContent === undefined) {
    return DEFAULT_BODY;
  }
  const match = existingContent.match(FRONT_MATTER_RE);
  if (!match) {
    return existingContent.length > 0 ? existingContent : DEFAULT_BODY;
  }
  const body = match[2] ?? '';
  return body.length > 0 ? body : DEFAULT_BODY;
}

export function buildDesignMd(input: BuildInput): string {
  const yaml = renderFrontMatter(input.parsed);
  const body = extractBody(input.existingContent);
  return `---\n${yaml}---\n${body}`;
}

export interface RunOptions {
  check: boolean;
  variablesCssPath: string;
  designMdPath: string;
  readFile: (p: string) => string;
  existsFile: (p: string) => boolean;
  writeFile: (p: string, contents: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function run(options: RunOptions): 0 | 1 {
  const cssContent = options.readFile(options.variablesCssPath);
  const vars = parseCssVariables(cssContent);
  const parsed = classifyTokens(vars);
  const existing = options.existsFile(options.designMdPath)
    ? options.readFile(options.designMdPath)
    : undefined;
  const next = buildDesignMd({ existingContent: existing, parsed });

  if (options.check) {
    if (existing !== next) {
      options.logger.error(
        'DESIGN.md is out of sync with web/styles/partials/variables.css. Run: npm --prefix web run design:sync',
      );
      return 1;
    }
    options.logger.log('DESIGN.md is in sync with variables.css.');
    return 0;
  }

  options.writeFile(options.designMdPath, next);
  options.logger.log(`Wrote ${options.designMdPath}`);
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
  const check = process.argv.includes('--check');
  const code = run({
    check,
    variablesCssPath: VARIABLES_CSS_PATH,
    designMdPath: DESIGN_MD_PATH,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    existsFile: (p) => fs.existsSync(p),
    writeFile: (p, c) => fs.writeFileSync(p, c, 'utf8'),
    logger: console,
  });
  process.exit(code);
}
