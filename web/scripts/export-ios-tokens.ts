/**
 * Export the design tokens defined by web/DESIGN.md into Swift source +
 * Asset Catalog colorsets that the iOS app consumes via a `DS` namespace.
 *
 * Pipeline:
 *   shared/DESIGN.md (YAML front matter)
 *     -> parsed via the same parseCssVariables/classifyTokens used by the
 *        web sync script (we re-read variables.css through the existing
 *        pipeline so we get authoritative values, not the YAML mirror)
 *     -> emits:
 *          ios/MurphysLaws/DesignSystem/Tokens.swift
 *          ios/MurphysLaws/Assets.xcassets/DS/<name>.colorset/Contents.json
 *
 * Modes:
 *   <no flag>  : write the outputs to disk; prune any stale colorsets left
 *                over from tokens that have since been removed from DESIGN.md
 *   --check    : smoke-test only. Run the generator in memory, surface
 *                pairing warnings, and return 0. Used by `design:check`
 *                in CI to catch generator bugs without polluting the
 *                working tree.
 *
 * Outputs are gitignored: `ios/MurphysLaws/Assets.xcassets/DS/` and
 * `ios/MurphysLaws/DesignSystem/` are produced by `ios/generate-xcode-project.sh`
 * before `xcodegen generate`, regenerated on every `make setup` /
 * `./generate-xcode-project.sh` run. There is no committed baseline to
 * drift from, which is why `--check` is a smoke test rather than a diff
 * comparison.
 *
 * Dark-mode pairing: the iOS Asset Catalog stores light + dark hex inside
 * one colorset, which iOS picks automatically based on `UITraitCollection`.
 * We pair tokens by an explicit override map plus a fallback `dark-<name>`
 * heuristic (see DARK_PAIR_OVERRIDES below). Tokens that pair as a dark
 * counterpart are NOT emitted as standalone colorsets - they are folded
 * into their light partner. Unpaired tokens (light-only or dark-only)
 * each get a single-appearance colorset.
 *
 * The Swift file references colorsets by name with `Color("DS/<name>",
 * bundle: .main)`; the asset catalog folder is namespaced under "DS/" so
 * the design-token names cannot collide with hand-authored colorsets such
 * as AccentColor or LaunchScreenBackground.
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
const IOS_ROOT = path.resolve(__dirname, '../../ios/MurphysLaws');
const TOKENS_SWIFT_PATH = path.resolve(IOS_ROOT, 'DesignSystem/Tokens.swift');
const COLORSETS_ROOT = path.resolve(IOS_ROOT, 'Assets.xcassets/DS');

/**
 * Asymmetric light/dark pairs that don't follow the simple `dark-<name>`
 * convention. Web's theme.css (web/styles/partials/theme.css lines 17-36)
 * is the source of truth: it explicitly remaps light tokens onto their
 * dark counterparts. We mirror those decisions here.
 *
 * The override is also the only way a `dark-`-prefixed token can be
 * treated as a LIGHT token in the pairing pass below (`dark-bg` and
 * `dark-text` are the light-mode values of the calc-dark / "dark
 * emphasis" surface; their dark-mode counterparts are `dark-dark-bg` /
 * `dark-dark-fg`). Without entries here, the `startsWith('dark-')` skip
 * would prevent them from pairing and they'd render the same hex in
 * light and dark.
 */
const DARK_PAIR_OVERRIDES: Record<string, string> = {
  bg: 'dark-bg-primary',
  fg: 'dark-fg-primary',
  // Web reuses `*-text` for "foreground on the matching `*-bg` surface"
  // and pairs them with `dark-*-fg` in dark mode. The convention is
  // inconsistent in the source (see CHANGELOG note on success-text), so
  // we hard-code the mapping rather than parse intent.
  'success-text': 'dark-success-fg',
  'error-text': 'dark-error-fg',
  'warning-text': 'dark-warning-fg',
  'orange-text': 'dark-orange-fg',
  // calc-dark / "dark emphasis" surface. `dark-bg` is the LIGHT-MODE value
  // of this semantic; `dark-dark-bg` is its dark-mode counterpart. Same
  // for dark-text / dark-dark-fg.
  'dark-bg': 'dark-dark-bg',
  'dark-text': 'dark-dark-fg',
};

/**
 * Light tokens that are intentionally dark-mode-stable (no swap). Listed
 * explicitly so the `dark-<name>` fallback doesn't accidentally pair them.
 * Mostly true neutrals and brand constants whose hex is the same in both
 * modes by design.
 */
const NO_DARK_PAIR = new Set<string>([
  'white',
  'highlight',
  'gradient-blue',
  'gradient-dark-1',
  'gradient-dark-2',
  'success', // semantic green; same hex both modes
  'error', // semantic red; same hex both modes
  'important',
]);

export interface PairResult {
  /** Light/universal token name -> { light hex, optional dark hex } */
  pairs: Map<string, { light: string; dark?: string }>;
  /** Tokens emitted only with a dark hex (no light counterpart). */
  darkOnly: Map<string, string>;
  /** Names of tokens consumed as a dark counterpart (so we don't double-emit). */
  consumedAsDark: Set<string>;
  /** Light tokens whose `dark-` counterpart was expected but missing. */
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
 *                              Swift identifiers
 * ========================================================================== */

/**
 * Convert a DESIGN.md token name (kebab-case) into a Swift-friendly
 * camelCase identifier. Numeric leading digits are escaped with an `s`
 * prefix to keep the identifier valid (e.g. spacing key "1" -> "s1").
 */
export function swiftIdentifier(name: string): string {
  const camel = name.replace(/-([a-z0-9])/g, (_m, ch: string) => ch.toUpperCase());
  if (/^\d/.test(camel)) {
    return `s${camel}`;
  }
  return camel;
}

/** SwiftUI Font.Weight identifier matching CSS numeric weight. */
function swiftFontWeight(weight: number): string {
  switch (weight) {
    case 100:
      return '.ultraLight';
    case 200:
      return '.thin';
    case 300:
      return '.light';
    case 400:
      return '.regular';
    case 500:
      return '.medium';
    case 600:
      return '.semibold';
    case 700:
      return '.bold';
    case 800:
      return '.heavy';
    case 900:
      return '.black';
    default:
      return '.regular';
  }
}

/** Parse "16px" -> 16 (integer). Returns null on unrecognised shapes. */
function parsePx(value: string): number | null {
  const m = value.match(/^([\d.]+)px$/);
  if (!m || m[1] === undefined) return null;
  return parseFloat(m[1]);
}

/* ==========================================================================
 *                              Asset catalog
 * ========================================================================== */

/**
 * One Asset Catalog colorset Contents.json. The Asset Catalog format
 * documents both light/universal and dark via the `appearances` key on
 * additional color entries.
 */
export function buildColorsetContents(
  light: string,
  dark: string | undefined,
): string {
  const entries: object[] = [
    {
      idiom: 'universal',
      color: hexToColorJson(light),
    },
  ];
  if (dark !== undefined) {
    entries.push({
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      color: hexToColorJson(dark),
    });
  }
  const doc = {
    colors: entries,
    info: { author: 'web/scripts/export-ios-tokens.ts', version: 1 },
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function hexToColorJson(
  hex: string,
): { 'color-space': string; components: Record<string, string> } {
  const cleaned = hex.replace(/^#/, '');
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const a =
    cleaned.length === 8
      ? parseInt(cleaned.slice(6, 8), 16) / 255
      : 1.0;
  return {
    'color-space': 'srgb',
    components: {
      red: r.toFixed(3),
      green: g.toFixed(3),
      blue: b.toFixed(3),
      alpha: a.toFixed(3),
    },
  };
}

/** Top-level Contents.json for the DS namespace folder. */
export function buildNamespaceContents(): string {
  const doc = {
    info: { author: 'web/scripts/export-ios-tokens.ts', version: 1 },
    properties: { 'provides-namespace': true },
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

/* ==========================================================================
 *                              Swift emission
 * ========================================================================== */

const SWIFT_FILE_HEADER = `// This file is generated by web/scripts/export-ios-tokens.ts.
// Do not edit by hand. Regenerate with: npm --prefix web run design:export:ios
//
// The DS namespace mirrors shared/DESIGN.md tokens for SwiftUI consumption.
// Colors are pulled from Assets.xcassets/DS/<name>.colorset so dark-mode
// pairing is handled by the system trait collection.
//
// swiftlint:disable identifier_name file_length

import SwiftUI
import CoreGraphics
`;

export interface IosArtifacts {
  /** Full Swift source for ios/MurphysLaws/DesignSystem/Tokens.swift. */
  swift: string;
  /** colorset path -> Contents.json content. Path is relative to IOS_ROOT. */
  colorsets: Map<string, string>;
  /** Pairing diagnostics (also surfaced via logger when the script runs). */
  warnings: string[];
}

export function buildIosArtifacts(parsed: ClassifiedTokens): IosArtifacts {
  const pairResult = pairColorTokens(parsed.colors);
  const colorsets = new Map<string, string>();

  // Top-level namespace folder so DS/ behaves as its own asset namespace.
  colorsets.set('Assets.xcassets/DS/Contents.json', buildNamespaceContents());

  for (const [name, { light, dark }] of pairResult.pairs) {
    colorsets.set(
      `Assets.xcassets/DS/${name}.colorset/Contents.json`,
      buildColorsetContents(light, dark),
    );
  }
  for (const [name, hex] of pairResult.darkOnly) {
    colorsets.set(
      `Assets.xcassets/DS/${name}.colorset/Contents.json`,
      buildColorsetContents(hex, undefined),
    );
  }

  const swift = renderSwift(parsed, pairResult);
  return { swift, colorsets, warnings: pairResult.warnings };
}

function renderSwift(parsed: ClassifiedTokens, pairResult: PairResult): string {
  const lines: string[] = [];
  lines.push(SWIFT_FILE_HEADER);
  lines.push('public enum DS {');
  lines.push('');

  // Color
  lines.push('    public enum Color {');
  const colorNames: string[] = [];
  for (const name of pairResult.pairs.keys()) colorNames.push(name);
  for (const name of pairResult.darkOnly.keys()) colorNames.push(name);
  for (const name of colorNames) {
    lines.push(
      `        public static let ${swiftIdentifier(name)} = SwiftUI.Color("DS/${name}", bundle: .main)`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Spacing
  lines.push('    public enum Spacing {');
  const spacingKeys = [...parsed.spacing.keys()].sort(
    (a, b) => Number(a) - Number(b),
  );
  for (const key of spacingKeys) {
    const px = parsePx(parsed.spacing.get(key)!);
    if (px === null) continue;
    lines.push(
      `        public static let ${swiftIdentifier(key)}: CoreGraphics.CGFloat = ${px}`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Radius
  lines.push('    public enum Radius {');
  for (const [key, dim] of Object.entries(ROUNDED_SCALE)) {
    const px = parsePx(dim);
    if (px === null) continue;
    lines.push(
      `        public static let ${swiftIdentifier(key)}: CoreGraphics.CGFloat = ${px}`,
    );
  }
  lines.push('    }');
  lines.push('');

  // Typography
  lines.push('    public enum Typography {');
  lines.push('');
  lines.push('        public struct Level {');
  lines.push('            public let font: SwiftUI.Font');
  lines.push('            /// Additive lineSpacing to apply via .lineSpacing(_:)');
  lines.push('            /// SwiftUI lineSpacing is additive (extra leading), so we');
  lines.push('            /// pre-compute (lineHeight - 1.0) * fontSize at codegen time.');
  lines.push('            public let lineSpacing: CoreGraphics.CGFloat');
  lines.push('            public let letterSpacing: CoreGraphics.CGFloat?');
  lines.push('        }');
  lines.push('');
  for (const [level, props] of Object.entries(TYPOGRAPHY_LEVELS)) {
    lines.push(...renderTypographyLevel(level, props));
    lines.push('');
  }
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('// swiftlint:enable identifier_name file_length');
  lines.push('');

  return lines.join('\n');
}

function renderTypographyLevel(
  level: string,
  props: TypographyLevel,
): string[] {
  const fontSize = parsePx(props.fontSize);
  if (fontSize === null) return [];
  const lineHeightRatio = Number(props.lineHeight);
  const lineSpacing = Number.isFinite(lineHeightRatio)
    ? Math.max(0, (lineHeightRatio - 1) * fontSize)
    : 0;
  const letterSpacing =
    props.letterSpacing !== undefined
      ? emToPoints(props.letterSpacing, fontSize)
      : null;
  const ident = swiftIdentifier(level);
  const lines: string[] = [];
  lines.push(`        public static let ${ident} = Level(`);
  // Use Font.system as the fallback while Work Sans isn't bundled (PR
  // iOS-3 will flip these to Font.custom("WorkSans", size:) once the
  // TTFs are added).
  lines.push(
    `            font: SwiftUI.Font.system(size: ${fontSize}, weight: ${swiftFontWeight(props.fontWeight)}),`,
  );
  lines.push(
    `            lineSpacing: ${roundTo3(lineSpacing)},`,
  );
  if (letterSpacing !== null) {
    lines.push(`            letterSpacing: ${roundTo3(letterSpacing)}`);
  } else {
    lines.push('            letterSpacing: nil');
  }
  lines.push('        )');
  return lines;
}

/**
 * Convert a CSS letter-spacing in `em` to absolute points relative to the
 * level's font size. CSS `1em` == 1 font-size unit, so the conversion is
 * trivial multiplication.
 */
function emToPoints(em: string, fontSize: number): number {
  const m = em.match(/^(-?[\d.]+)em$/);
  if (!m || m[1] === undefined) return 0;
  return parseFloat(m[1]) * fontSize;
}

function roundTo3(n: number): string {
  // Strip trailing zeros so the generated source diff stays minimal across
  // value tweaks (e.g. 4.800 -> 4.8). Avoid scientific notation.
  return Number(n.toFixed(3)).toString();
}

/* ==========================================================================
 *                              Run / check
 * ========================================================================== */

export interface IosRunOptions {
  check: boolean;
  variablesCssPath: string;
  iosRoot: string;
  readFile: (p: string) => string;
  existsFile: (p: string) => boolean;
  /** Recursive list of regular files under a directory, returned as paths. */
  walkFiles: (dir: string) => string[];
  mkdirp: (p: string) => void;
  writeFile: (p: string, contents: string) => void;
  unlinkFile: (p: string) => void;
  /** Remove an empty directory; no-op if it doesn't exist or isn't empty. */
  rmEmptyDir: (p: string) => void;
  logger: Pick<Console, 'log' | 'error'>;
}

export function runIosExport(options: IosRunOptions): 0 | 1 {
  const css = options.readFile(options.variablesCssPath);
  const parsed = classifyTokens(parseCssVariables(css));
  const artifacts = buildIosArtifacts(parsed);

  for (const w of artifacts.warnings) {
    options.logger.log(`warn: ${w}`);
  }

  if (options.check) {
    // Outputs are gitignored, so there's no committed baseline to compare
    // against. --check just verifies the generator runs cleanly and would
    // produce a non-empty Swift file plus at least one colorset.
    if (!artifacts.swift.includes('public enum DS')) {
      options.logger.error(
        'iOS exporter produced unexpected Swift output (missing `public enum DS`).',
      );
      return 1;
    }
    // colorsets always contains the namespace marker (DS/Contents.json),
    // so size <= 1 means no real color tokens were emitted.
    if (artifacts.colorsets.size <= 1) {
      options.logger.error(
        'iOS exporter produced 0 token colorsets; check shared/DESIGN.md.',
      );
      return 1;
    }
    options.logger.log(
      `iOS design tokens generator runs cleanly: would write Tokens.swift + ${artifacts.colorsets.size - 1} colorset(s).`,
    );
    return 0;
  }

  const swiftPath = path.join(
    options.iosRoot,
    'DesignSystem/Tokens.swift',
  );
  const colorsetsRoot = path.join(options.iosRoot, 'Assets.xcassets/DS');

  const desiredFiles = new Map<string, string>();
  desiredFiles.set(swiftPath, artifacts.swift);
  for (const [rel, contents] of artifacts.colorsets) {
    desiredFiles.set(path.join(options.iosRoot, rel), contents);
  }

  // Walk what's currently on disk so we can prune stale colorsets left
  // over from tokens that were removed from DESIGN.md.
  const existingFiles = new Set(options.walkFiles(colorsetsRoot));
  if (options.existsFile(swiftPath)) existingFiles.add(swiftPath);

  for (const [p, contents] of desiredFiles) {
    options.mkdirp(path.dirname(p));
    options.writeFile(p, contents);
  }
  for (const p of existingFiles) {
    if (!desiredFiles.has(p)) {
      options.unlinkFile(p);
      // Try to clean up empty parent (a colorset directory).
      options.rmEmptyDir(path.dirname(p));
    }
  }
  options.logger.log(`Wrote ${swiftPath}`);
  options.logger.log(
    `Wrote ${desiredFiles.size - 1} colorset file(s) under ${colorsetsRoot}`,
  );
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
  const code = runIosExport({
    check,
    variablesCssPath: VARIABLES_CSS_PATH,
    iosRoot: IOS_ROOT,
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    existsFile: (p) => fs.existsSync(p),
    walkFiles: walkFilesFs,
    mkdirp: (p) => fs.mkdirSync(p, { recursive: true }),
    writeFile: (p, c) => fs.writeFileSync(p, c, 'utf8'),
    unlinkFile: (p) => fs.unlinkSync(p),
    rmEmptyDir: (p) => {
      try {
        fs.rmdirSync(p);
      } catch {
        // Non-empty or already gone; leave it.
      }
    },
    logger: console,
  });
  // Reference TOKENS_SWIFT_PATH and COLORSETS_ROOT here so they aren't
  // tree-shaken; they document the canonical output locations even if
  // run() takes them via options.
  void TOKENS_SWIFT_PATH;
  void COLORSETS_ROOT;
  process.exit(code);
}

function walkFilesFs(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFilesFs(p));
    } else if (entry.isFile()) {
      out.push(p);
    }
  }
  return out;
}
