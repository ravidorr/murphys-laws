import { describe, it, expect } from 'vitest';
import {
  pairColorTokens,
  kotlinIdentifier,
  androidResourceName,
  hexToComposeArgb,
  buildAndroidArtifacts,
  runAndroidExport,
  type AndroidRunOptions,
} from '../scripts/export-android-tokens.ts';
import {
  classifyTokens,
  parseCssVariables,
  type ClassifiedTokens,
} from '../scripts/sync-design-tokens.ts';

interface PairLocalThis {
  colors?: Map<string, string>;
  result?: ReturnType<typeof pairColorTokens>;
}

interface IdentLocalThis {
  input?: string;
  output?: string;
}

interface ArgbLocalThis {
  input?: string;
  output?: string;
}

interface ArtifactsLocalThis {
  parsed?: ClassifiedTokens;
  artifacts?: ReturnType<typeof buildAndroidArtifacts>;
}

interface RunLocalThis {
  files?: Map<string, string>;
  written?: Map<string, string>;
  dirs?: Set<string>;
  logs?: string[];
  errors?: string[];
  options?: AndroidRunOptions;
  code?: 0 | 1;
}

function sampleCss(): string {
  return `:root {
  --space-1: 0.25rem;
  --space-4: 1rem;

  --bg: #ffffff;
  --fg: #111827;
  --muted-fg: #4b5563;
  --primary: #030213;
  --btn-primary-bg: #0d5ea1;
  --btn-primary-fg: #ffffff;
  --error: #b91c1c;
  --error-bg: #fee2e2;
  --error-text: #991b1b;
  --white: #ffffff;
  --dark-bg: #f0d6d6;

  --dark-bg-primary: #0b0b11;
  --dark-fg-primary: #e9eaee;
  --dark-muted-fg: #9ca3af;
  --dark-primary: #6366f1;
  --dark-error-bg: #3c151d;
  --dark-error-fg: #ffc4cc;
  --dark-link: #9ecbff;
  --dark-dark-bg: #2a1b1b;
}`;
}

function buildRunLocalThis(initialFiles: Record<string, string> = {}): RunLocalThis {
  const localThis: RunLocalThis = {};
  localThis.files = new Map(Object.entries(initialFiles));
  localThis.written = new Map();
  localThis.dirs = new Set();
  localThis.logs = [];
  localThis.errors = [];
  localThis.options = {
    check: false,
    variablesCssPath: '/virt/variables.css',
    tokensKtPath: '/virt/android/Tokens.kt',
    colorsXmlPath: '/virt/android/colors.xml',
    colorsNightXmlPath: '/virt/android-night/colors.xml',
    dimensXmlPath: '/virt/android/dimens.xml',
    readFile: (p: string): string => {
      const v = localThis.files!.get(p);
      if (v === undefined) throw new Error(`readFile missing: ${p}`);
      return v;
    },
    existsFile: (p: string): boolean => localThis.files!.has(p),
    mkdirp: (p: string): void => {
      localThis.dirs!.add(p);
    },
    writeFile: (p: string, contents: string): void => {
      localThis.written!.set(p, contents);
      localThis.files!.set(p, contents);
    },
    logger: {
      log: (...args: unknown[]): void => {
        localThis.logs!.push(args.map((a) => String(a)).join(' '));
      },
      error: (...args: unknown[]): void => {
        localThis.errors!.push(args.map((a) => String(a)).join(' '));
      },
    },
  };
  return localThis;
}

describe('pairColorTokens (Android)', () => {
  it('honours the same DARK_PAIR_OVERRIDES the iOS exporter uses (bg -> dark-bg-primary)', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['bg', '#ffffff'],
      ['dark-bg', '#f0d6d6'],
      ['dark-bg-primary', '#0b0b11'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('bg')).toEqual({
      light: '#ffffff',
      dark: '#0b0b11',
    });
    // dark-bg is its own override-driven pair (the calc-dark "dark
    // emphasis" semantic). Without dark-dark-bg in this input it stays
    // light-only and the override warns about the missing target.
    expect(localThis.result.pairs.get('dark-bg')).toEqual({ light: '#f0d6d6' });
    expect(localThis.result.darkOnly.has('dark-bg')).toBe(false);
  });

  it('pairs dark-bg with dark-dark-bg (calc-dark "dark emphasis" surface) so values-night/colors.xml gets the swap', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['dark-bg', '#f0d6d6'],
      ['dark-dark-bg', '#2a1b1b'],
      ['dark-text', '#2b0000'],
      ['dark-dark-fg', '#f0d6d6'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('dark-bg')).toEqual({
      light: '#f0d6d6',
      dark: '#2a1b1b',
    });
    expect(localThis.result.pairs.get('dark-text')).toEqual({
      light: '#2b0000',
      dark: '#f0d6d6',
    });
    expect(localThis.result.consumedAsDark.has('dark-dark-bg')).toBe(true);
    expect(localThis.result.consumedAsDark.has('dark-dark-fg')).toBe(true);
    expect(localThis.result.darkOnly.has('dark-dark-bg')).toBe(false);
    expect(localThis.result.darkOnly.has('dark-dark-fg')).toBe(false);
  });

  it('emits dark-only tokens unchanged so consumers can still reach dark-link etc.', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([['dark-link', '#9ecbff']]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.darkOnly.get('dark-link')).toBe('#9ecbff');
  });
});

describe('kotlinIdentifier', () => {
  it('camelCases kebab-case names', () => {
    const localThis: IdentLocalThis = {};
    localThis.input = 'btn-primary-bg';
    localThis.output = kotlinIdentifier(localThis.input);
    expect(localThis.output).toBe('btnPrimaryBg');
  });

  it('escapes leading-digit names with an "s" prefix', () => {
    expect(kotlinIdentifier('1')).toBe('s1');
    expect(kotlinIdentifier('16')).toBe('s16');
  });
});

describe('androidResourceName', () => {
  it('joins prefix and underscore-converted name with a single underscore', () => {
    expect(androidResourceName('ds', 'btn-primary-bg')).toBe('ds_btn_primary_bg');
    expect(androidResourceName('ds_space', '1')).toBe('ds_space_1');
    expect(androidResourceName('ds_radius', 'sm')).toBe('ds_radius_sm');
  });
});

describe('hexToComposeArgb', () => {
  it('converts 6-digit RGB to 0xFF + RRGGBB uppercase', () => {
    const localThis: ArgbLocalThis = {};
    localThis.input = '#ff8040';
    localThis.output = hexToComposeArgb(localThis.input);
    expect(localThis.output).toBe('0xFFFF8040');
  });

  it('reorders 8-digit CSS RRGGBBAA to Compose AARRGGBB', () => {
    expect(hexToComposeArgb('#80ff8040')).toBe('0x4080FF80');
  });

  it('throws on hex shapes that arent 6 or 8 hex chars after #', () => {
    expect(() => hexToComposeArgb('#fff')).toThrow();
  });
});

describe('buildAndroidArtifacts', () => {
  it('emits a Kotlin file declaring object DS with Color, Spacing, Radius, Typography', () => {
    const localThis: ArtifactsLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.artifacts = buildAndroidArtifacts(localThis.parsed);

    expect(localThis.artifacts.kt).toContain('object DS {');
    expect(localThis.artifacts.kt).toContain('object Color {');
    expect(localThis.artifacts.kt).toContain('object Spacing {');
    expect(localThis.artifacts.kt).toContain('object Radius {');
    expect(localThis.artifacts.kt).toContain('object Typography {');
  });

  it('uses fully-qualified androidx.compose.ui.graphics.Color so DS.Color does not shadow the Compose Color class', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { kt } = buildAndroidArtifacts(parsed);

    expect(kt).toContain(
      'val bg: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(0xFFFFFFFF)',
    );
    // No naked `import androidx.compose.ui.graphics.Color` — it would
    // collide with the inner `object Color`.
    expect(kt).not.toMatch(/^import androidx\.compose\.ui\.graphics\.Color$/m);
  });

  it('names dark counterparts after the actual DESIGN.md dark-token name (avoids collision with darkOnly tokens)', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { kt } = buildAndroidArtifacts(parsed);

    // bg pairs with dark-bg-primary -> identifier darkBgPrimary
    expect(kt).toMatch(/val darkBgPrimary: androidx\.compose\.ui\.graphics\.Color/);
    // The standalone `dark-bg` token still exists as `darkBg`, no collision.
    expect(kt).toMatch(/val darkBg: androidx\.compose\.ui\.graphics\.Color/);
    // success-text pairs with dark-success-fg via override
    expect(kt).toMatch(/val darkErrorFg: androidx\.compose\.ui\.graphics\.Color/);
  });

  it('emits Spacing and Radius vals as Dp', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { kt } = buildAndroidArtifacts(parsed);

    expect(kt).toContain('val s1: Dp = 4.dp');
    expect(kt).toContain('val s4: Dp = 16.dp');
    expect(kt).toContain('val sm: Dp = 4.dp');
    expect(kt).toContain('val full: Dp = 9999.dp');
  });

  it('emits typography levels with absolute lineHeight (CSS multiplier x fontSize) so Compose can render directly', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { kt } = buildAndroidArtifacts(parsed);

    // display: 48px x 1.1 = 52.8.sp
    expect(kt).toMatch(/val display: TextStyle = TextStyle\([\s\S]*?lineHeight = 52\.8\.sp/);
    // bodyMd: 16px x 1.5 = 24.sp
    expect(kt).toMatch(/val bodyMd: TextStyle = TextStyle\([\s\S]*?lineHeight = 24\.sp/);
    // display: -0.02em x 48 = -0.96.sp
    expect(kt).toMatch(/val display: TextStyle = TextStyle\([\s\S]*?letterSpacing = -0\.96\.sp/);
  });

  it('uses the WorkSans FontFamily declared in WorkSans.kt for every typography level', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { kt } = buildAndroidArtifacts(parsed);
    expect(kt).toContain('fontFamily = WorkSans');
    // Guard against regression to the FontFamily.Default placeholder.
    expect(kt).not.toContain('FontFamily.Default');
  });

  it('emits values/colors.xml with ds_-prefixed snake_case names', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { colorsXml } = buildAndroidArtifacts(parsed);

    expect(colorsXml).toContain('<color name="ds_bg">#ffffff</color>');
    expect(colorsXml).toContain('<color name="ds_btn_primary_bg">#0d5ea1</color>');
    expect(colorsXml).toContain('<color name="ds_muted_fg">#4b5563</color>');
  });

  it('emits values-night/colors.xml with the SAME names but dark hex (so consumers get auto-swap via the Android resource system)', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { colorsNightXml } = buildAndroidArtifacts(parsed);

    expect(colorsNightXml).toContain('<color name="ds_bg">#0b0b11</color>');
    expect(colorsNightXml).toContain('<color name="ds_muted_fg">#9ca3af</color>');
    // Tokens without a dark counterpart are NOT in night/colors.xml
    expect(colorsNightXml).not.toContain('ds_white');
    expect(colorsNightXml).not.toContain('ds_btn_primary_fg');
  });

  it('emits dimens.xml with ds_space_<n> and ds_radius_<level> entries', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { dimensXml } = buildAndroidArtifacts(parsed);

    expect(dimensXml).toContain('<dimen name="ds_space_1">4dp</dimen>');
    expect(dimensXml).toContain('<dimen name="ds_space_4">16dp</dimen>');
    expect(dimensXml).toContain('<dimen name="ds_radius_sm">4dp</dimen>');
    expect(dimensXml).toContain('<dimen name="ds_radius_full">9999dp</dimen>');
  });
});

describe('runAndroidExport', () => {
  it('writes Tokens.kt + colors.xml + values-night/colors.xml + dimens.xml in write mode', () => {
    const localThis = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    localThis.options!.check = false;

    localThis.code = runAndroidExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.written!.has('/virt/android/Tokens.kt')).toBe(true);
    expect(localThis.written!.has('/virt/android/colors.xml')).toBe(true);
    expect(localThis.written!.has('/virt/android-night/colors.xml')).toBe(true);
    expect(localThis.written!.has('/virt/android/dimens.xml')).toBe(true);
  });

  it('returns 0 in --check mode (smoke test) without writing anything to disk', () => {
    const localThis = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    localThis.options!.check = true;

    localThis.code = runAndroidExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.written!.size).toBe(0);
    expect(
      localThis.logs!.some((l) =>
        l.includes('Android design tokens generator runs cleanly'),
      ),
    ).toBe(true);
  });

  it('returns 1 in --check mode if the generator would emit empty output (canary for a malformed shared/DESIGN.md)', () => {
    const localThis = buildRunLocalThis({
      '/virt/variables.css': ':root {}',
    });
    localThis.options!.check = true;

    localThis.code = runAndroidExport(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) =>
        e.includes('Android exporter produced 0 color tokens'),
      ),
    ).toBe(true);
  });
});
