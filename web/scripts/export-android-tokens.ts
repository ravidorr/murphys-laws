/**
 * Export the design tokens defined by web/DESIGN.md into Kotlin source +
 * Android resource XML that the Android app consumes via a `DS` namespace
 * (Compose) and `@color/ds_*` / `@dimen/ds_*` resources (XML layouts).
 *
 * Pipeline mirrors export-ios-tokens.ts:
 *   web/styles/partials/variables.css
 *     -> parseCssVariables + classifyTokens (shared with the web sync)
 *     -> emits:
 *          android/app/src/main/java/com/murphyslaws/ui/theme/Tokens.kt
 *          android/app/src/main/res/values/colors.xml
 *          android/app/src/main/res/values-night/colors.xml  (only dark pairs)
 *          android/app/src/main/res/values/dimens.xml
 *
 * Modes:
 *   <no flag>  : write to disk
 *   --check    : smoke-test only. Run the generator in memory; return 0
 *                if it produces non-empty Kotlin and XML output. Used by
 *                `design:check` in CI to catch generator bugs without
 *                polluting the working tree.
 *
 * Outputs are gitignored: Tokens.kt, the two colors.xml files, and dimens.xml
 * are produced by an `exportDesignTokens` Gradle task wired into preBuild,
 * regenerated on every Gradle run. There is no committed baseline to drift
 * from, which is why `--check` is a smoke test rather than a diff comparison.
 *
 * Dark-mode model differs from iOS:
 *   - The Kotlin object exposes BOTH `bg` and `darkBgPrimary` as separate vals
 *     so Theme.kt can plug them into Compose's lightColorScheme/darkColorScheme.
 *     Compose's MaterialTheme drives the swap, not the resource system.
 *   - The XML resources DO use the day/night (values-night/) auto-swap
 *     mechanism. They exist for any non-Compose consumer (View XML, drawables).
 *
 * Resource naming: `ds_<token-with-underscores>` for both colors and dimens.
 * The `ds_` prefix namespaces our generated names away from any hand-authored
 * Android resources (e.g. `ic_launcher_background`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCssVariables,
  classifyTokens,
  TYPOGRAPHY_LEVELS,
  ROUNDED_SCALE,
  type ClassifiedTokens,
  type TypographyLevel,
} from './sync-design-tokens.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VARIABLES_CSS_PATH = path.resolve(
  __dirname,
  '../styles/partials/variables.css',
);
const ANDROID_ROOT = path.resolve(__dirname, '../../android');
const TOKENS_KT_PATH = path.resolve(
  ANDROID_ROOT,
  'app/src/main/java/com/murphyslaws/ui/theme/Tokens.kt',
);
const COLORS_XML_PATH = path.resolve(
  ANDROID_ROOT,
  'app/src/main/res/values/colors.xml',
);
const COLORS_NIGHT_XML_PATH = path.resolve(
  ANDROID_ROOT,
  'app/src/main/res/values-night/colors.xml',
);
const DIMENS_XML_PATH = path.resolve(
  ANDROID_ROOT,
  'app/src/main/res/values/dimens.xml',
);

/**
 * Same asymmetric pair table as the iOS exporter. Kept duplicated rather than
 * extracted to a shared helper because iOS / Android may diverge later (e.g.
 * one platform may want `dark-bg` to pair with `dark-dark-bg` while the other
 * leaves it standalone). Today they agree, but we don't want to couple them.
 *
 * Override entries are also the only way a `dark-`-prefixed token can be
 * treated as a LIGHT token in the pairing pass below. `dark-bg` and
 * `dark-text` are the light-mode values of the calc-dark / "dark
 * emphasis" semantic; `dark-dark-bg` / `dark-dark-fg` are their dark-mode
 * counterparts. Without these entries the `startsWith('dark-')` skip
 * leaves them as standalone single-value resources that don't adapt.
 */
const DARK_PAIR_OVERRIDES: Record<string, string> = {
  bg: 'dark-bg-primary',
  fg: 'dark-fg-primary',
  'success-text': 'dark-success-fg',
  'error-text': 'dark-error-fg',
  'warning-text': 'dark-warning-fg',
  'orange-text': 'dark-orange-fg',
  // calc-dark / "dark emphasis" surface, see iOS exporter.
  'dark-bg': 'dark-dark-bg',
  'dark-text': 'dark-dark-fg',
};

const NO_DARK_PAIR = new Set<string>([
  'white',
  'highlight',
  'gradient-blue',
  'gradient-dark-1',
  'gradient-dark-2',
  'success',
  'error',
  'important',
]);

export interface PairResult {
  pairs: Map<string, { light: string; dark?: string }>;
  darkOnly: Map<string, string>;
  consumedAsDark: Set<string>;
  warnings: string[];
}

export function pairColorTokens(colors: Map<string, string>): PairResult {
  const pairs = new Map<string, { light: string; dark?: string }>();
  const consumedAsDark = new Set<string>();
  const warnings: string[] = [];

  for (const [name, hex] of colors) {
    // Skip dark-prefixed tokens UNLESS they're listed as a light source in
    // DARK_PAIR_OVERRIDES. The override list is what tells us a `dark-*`
    // token is actually the light-mode value of a "dark emphasis"-style
    // semantic (e.g. `dark-bg`, `dark-text`) and should pair with its own
    // `dark-dark-*` counterpart.
    if (name.startsWith('dark-') && !(name in DARK_PAIR_OVERRIDES)) continue;
    if (NO_DARK_PAIR.has(name)) {
      pairs.set(name, { light: hex });
      continue;
    }
    const overrideTarget = DARK_PAIR_OVERRIDES[name];
    const candidate = overrideTarget ?? `dark-${name}`;
    const darkHex = colors.get(candidate);
    if (darkHex !== undefined) {
      pairs.set(name, { light: hex, dark: darkHex });
      consumedAsDark.add(candidate);
    } else {
      pairs.set(name, { light: hex });
      if (overrideTarget !== undefined) {
        warnings.push(
          `pair override ${name} -> ${overrideTarget}: dark token not found in DESIGN.md`,
        );
      }
    }
  }

  const darkOnly = new Map<string, string>();
  for (const [name, hex] of colors) {
    if (!name.startsWith('dark-')) continue;
    // Skip anything already classified - either as a light token in `pairs`
    // (via DARK_PAIR_OVERRIDES, e.g. `dark-bg`) or consumed as some other
    // token's dark counterpart.
    if (pairs.has(name) || consumedAsDark.has(name)) continue;
    darkOnly.set(name, hex);
  }

  return { pairs, darkOnly, consumedAsDark, warnings };
}

/* ==========================================================================
 *                              Identifier helpers
 * ========================================================================== */

/**
 * Convert a kebab-case token name to a Kotlin-friendly camelCase identifier.
 * Numeric leading digits are escaped with an `s` prefix (Kotlin allows leading
 * digits in identifiers only inside backticks; we avoid that for ergonomics).
 */
export function kotlinIdentifier(name: string): string {
  const camel = name.replace(/-([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
  if (/^\d/.test(camel)) {
    return `s${camel}`;
  }
  return camel;
}

/** Convert a kebab-case name to a `ds_`-prefixed Android resource name. */
export function androidResourceName(prefix: string, name: string): string {
  return `${prefix}_${name.replace(/-/g, '_')}`;
}

/** SwiftUI->Compose: numeric weight to FontWeight constant. */
function composeFontWeight(weight: number): string {
  switch (weight) {
    case 100: return 'FontWeight.Thin';
    case 200: return 'FontWeight.ExtraLight';
    case 300: return 'FontWeight.Light';
    case 400: return 'FontWeight.Normal';
    case 500: return 'FontWeight.Medium';
    case 600: return 'FontWeight.SemiBold';
    case 700: return 'FontWeight.Bold';
    case 800: return 'FontWeight.ExtraBold';
    case 900: return 'FontWeight.Black';
    default: return 'FontWeight.Normal';
  }
}

/** Strip the `#` and zero-extend to AARRGGBB for Compose Color literals. */
export function hexToComposeArgb(hex: string): string {
  const cleaned = hex.replace(/^#/, '').toLowerCase();
  if (cleaned.length === 6) return `0xFF${cleaned.toUpperCase()}`;
  if (cleaned.length === 8) {
    // Input is RRGGBBAA (CSS 8-digit form). Compose wants AARRGGBB.
    const rgb = cleaned.slice(0, 6);
    const a = cleaned.slice(6, 8);
    return `0x${a.toUpperCase()}${rgb.toUpperCase()}`;
  }
  throw new Error(`hexToComposeArgb: unexpected hex shape ${hex}`);
}

function parsePx(value: string): number | null {
  const m = value.match(/^([\d.]+)px$/);
  if (!m || m[1] === undefined) return null;
  return parseFloat(m[1]);
}

function roundTo3(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/* ==========================================================================
 *                              Emission
 * ========================================================================== */

const KT_HEADER = `// This file is generated by web/scripts/export-android-tokens.ts.
// Do not edit by hand. Regenerate with: npm --prefix web run design:export:android
//
// The DS namespace mirrors shared/DESIGN.md tokens for Compose consumption.
// Light and dark color counterparts are exposed as separate vals so Theme.kt
// can plug them into MaterialTheme's lightColorScheme / darkColorScheme.

@file:Suppress("MagicNumber", "TopLevelPropertyNaming", "ObjectPropertyNaming")

package com.murphyslaws.ui.theme

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
`;

const XML_HEADER = `<?xml version="1.0" encoding="utf-8"?>
<!--
  This file is generated by web/scripts/export-android-tokens.ts.
  Do not edit by hand. Regenerate with: npm --prefix web run design:export:android
-->
`;

export interface AndroidArtifacts {
  kt: string;
  colorsXml: string;
  colorsNightXml: string;
  dimensXml: string;
  warnings: string[];
}

export function buildAndroidArtifacts(
  parsed: ClassifiedTokens,
): AndroidArtifacts {
  const pairResult = pairColorTokens(parsed.colors);
  return {
    kt: renderKotlin(parsed, pairResult),
    colorsXml: renderColorsXml(pairResult),
    colorsNightXml: renderColorsNightXml(pairResult),
    dimensXml: renderDimensXml(parsed),
    warnings: pairResult.warnings,
  };
}

function renderKotlin(
  parsed: ClassifiedTokens,
  pairResult: PairResult,
): string {
  const lines: string[] = [];
  lines.push(KT_HEADER);
  lines.push('object DS {');
  lines.push('');

  // Color
  //
  // Each light token gets a `<name>` val (light hex). If it has a paired
  // dark counterpart, we ALSO emit a val named after the actual DESIGN.md
  // dark-token name (`darkBgPrimary` for `bg`'s pair, not `darkBg`); that
  // avoids collisions with dark-only tokens that happen to share the
  // simple `dark-<lightName>` shape (e.g. `dark-bg` semantic).
  lines.push('    object Color {');
  for (const [name, { light, dark }] of pairResult.pairs) {
    const ident = kotlinIdentifier(name);
    lines.push(
      `        val ${ident}: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(${hexToComposeArgb(light)})`,
    );
    if (dark !== undefined) {
      const darkSource = DARK_PAIR_OVERRIDES[name] ?? `dark-${name}`;
      const darkIdent = kotlinIdentifier(darkSource);
      lines.push(
        `        val ${darkIdent}: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(${hexToComposeArgb(dark)})`,
      );
    }
  }
  for (const [name, hex] of pairResult.darkOnly) {
    lines.push(
      `        val ${kotlinIdentifier(name)}: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(${hexToComposeArgb(hex)})`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Spacing
  lines.push('    object Spacing {');
  const spacingKeys = [...parsed.spacing.keys()].sort(
    (a, b) => Number(a) - Number(b),
  );
  for (const key of spacingKeys) {
    const px = parsePx(parsed.spacing.get(key)!);
    if (px === null) continue;
    lines.push(
      `        val ${kotlinIdentifier(key)}: Dp = ${px}.dp`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Radius
  lines.push('    object Radius {');
  for (const [key, dim] of Object.entries(ROUNDED_SCALE)) {
    const px = parsePx(dim);
    if (px === null) continue;
    lines.push(
      `        val ${kotlinIdentifier(key)}: Dp = ${px}.dp`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Typography
  lines.push('    object Typography {');
  lines.push('');
  for (const [level, props] of Object.entries(TYPOGRAPHY_LEVELS)) {
    lines.push(...renderKotlinTypography(level, props));
    lines.push('');
  }
  lines.push('    }');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function renderKotlinTypography(
  level: string,
  props: TypographyLevel,
): string[] {
  const fontSize = parsePx(props.fontSize);
  if (fontSize === null) return [];
  const ratio = Number(props.lineHeight);
  const lineHeight = Number.isFinite(ratio) ? roundTo3(fontSize * ratio) : `${fontSize}`;
  const ident = kotlinIdentifier(level);
  const lines: string[] = [];
  lines.push(`        val ${ident}: TextStyle = TextStyle(`);
  // Phase 1 ships with FontFamily.Default (system Roboto on Android). PR
  // Android-3 will swap this to a Work Sans FontFamily once the TTF is
  // bundled in res/font/. Letter-spacing is converted from CSS em to
  // absolute sp at codegen time.
  lines.push('            fontFamily = FontFamily.Default,');
  lines.push(`            fontSize = ${fontSize}.sp,`);
  lines.push(`            fontWeight = ${composeFontWeight(props.fontWeight)},`);
  lines.push(`            lineHeight = ${lineHeight}.sp,`);
  if (props.letterSpacing !== undefined) {
    const m = props.letterSpacing.match(/^(-?[\d.]+)em$/);
    const ls = m && m[1] !== undefined ? parseFloat(m[1]) * fontSize : 0;
    lines.push(`            letterSpacing = ${roundTo3(ls)}.sp,`);
  }
  lines.push('        )');
  return lines;
}

function renderColorsXml(pairResult: PairResult): string {
  const lines: string[] = [];
  lines.push(XML_HEADER + '<resources>');
  for (const [name, { light }] of pairResult.pairs) {
    lines.push(
      `    <color name="${androidResourceName('ds', name)}">${light}</color>`,
    );
  }
  for (const [name, hex] of pairResult.darkOnly) {
    lines.push(
      `    <color name="${androidResourceName('ds', name)}">${hex}</color>`,
    );
  }
  lines.push('</resources>');
  lines.push('');
  return lines.join('\n');
}

/**
 * Dark-mode override: same resource names as values/colors.xml but with
 * the dark hex. Tokens without a dark counterpart aren't repeated here
 * (they keep their light value at runtime).
 */
function renderColorsNightXml(pairResult: PairResult): string {
  const lines: string[] = [];
  lines.push(XML_HEADER + '<resources>');
  for (const [name, { dark }] of pairResult.pairs) {
    if (dark === undefined) continue;
    lines.push(
      `    <color name="${androidResourceName('ds', name)}">${dark}</color>`,
    );
  }
  lines.push('</resources>');
  lines.push('');
  return lines.join('\n');
}

function renderDimensXml(parsed: ClassifiedTokens): string {
  const lines: string[] = [];
  lines.push(XML_HEADER + '<resources>');
  const spacingKeys = [...parsed.spacing.keys()].sort(
    (a, b) => Number(a) - Number(b),
  );
  for (const key of spacingKeys) {
    const px = parsePx(parsed.spacing.get(key)!);
    if (px === null) continue;
    lines.push(
      `    <dimen name="${androidResourceName('ds_space', key)}">${px}dp</dimen>`,
    );
  }
  for (const [key, dim] of Object.entries(ROUNDED_SCALE)) {
    const px = parsePx(dim);
    if (px === null) continue;
    lines.push(
      `    <dimen name="${androidResourceName('ds_radius', key)}">${px}dp</dimen>`,
    );
  }
  lines.push('</resources>');
  lines.push('');
  return lines.join('\n');
}

/* ==========================================================================
 *                              Run / check
 * ========================================================================== */

export interface AndroidRunOptions {
  check: boolean;
  variablesCssPath: string;
  tokensKtPath: string;
  colorsXmlPath: string;
  colorsNightXmlPath: string;
  dimensXmlPath: string;
  readFile: (p: string) => string;
  existsFile: (p: string) => boolean;
  mkdirp: (p: string) => void;
  writeFile: (p: string, contents: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function runAndroidExport(options: AndroidRunOptions): 0 | 1 {
  const css = options.readFile(options.variablesCssPath);
  const parsed = classifyTokens(parseCssVariables(css));
  const artifacts = buildAndroidArtifacts(parsed);

  for (const w of artifacts.warnings) {
    options.logger.log(`warn: ${w}`);
  }

  if (options.check) {
    if (!artifacts.kt.includes('object DS')) {
      options.logger.error(
        'Android exporter produced unexpected Kotlin output (missing `object DS`).',
      );
      return 1;
    }
    if (!artifacts.colorsXml.includes('<color name="ds_')) {
      options.logger.error(
        'Android exporter produced 0 color tokens; check shared/DESIGN.md.',
      );
      return 1;
    }
    options.logger.log(
      'Android design tokens generator runs cleanly: would write Tokens.kt + colors.xml + values-night/colors.xml + dimens.xml.',
    );
    return 0;
  }

  const desired: Array<[string, string]> = [
    [options.tokensKtPath, artifacts.kt],
    [options.colorsXmlPath, artifacts.colorsXml],
    [options.colorsNightXmlPath, artifacts.colorsNightXml],
    [options.dimensXmlPath, artifacts.dimensXml],
  ];

  for (const [p, contents] of desired) {
    options.mkdirp(path.dirname(p));
    options.writeFile(p, contents);
    options.logger.log(`Wrote ${p}`);
  }
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
  const code = runAndroidExport({
    check,
    variablesCssPath: VARIABLES_CSS_PATH,
    tokensKtPath: TOKENS_KT_PATH,
    colorsXmlPath: COLORS_XML_PATH,
    colorsNightXmlPath: COLORS_NIGHT_XML_PATH,
    dimensXmlPath: DIMENS_XML_PATH,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    existsFile: (p) => fs.existsSync(p),
    mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
    writeFile: (p, c) => fs.writeFileSync(p, c, 'utf8'),
    logger: console,
  });
  process.exit(code);
}
