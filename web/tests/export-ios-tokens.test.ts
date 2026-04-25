import { describe, it, expect } from 'vitest';
import {
  pairColorTokens,
  swiftIdentifier,
  buildColorsetContents,
  buildNamespaceContents,
  buildIosArtifacts,
  runIosExport,
  type IosRunOptions,
} from '../scripts/export-ios-tokens.ts';
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

interface ColorsetLocalThis {
  json?: string;
  parsed?: { colors: unknown[]; info: { author: string; version: number } };
}

interface ArtifactsLocalThis {
  parsed?: ClassifiedTokens;
  artifacts?: ReturnType<typeof buildIosArtifacts>;
}

interface RunLocalThis {
  files?: Map<string, string>;
  written?: Map<string, string>;
  unlinked?: Set<string>;
  rmEmpty?: Set<string>;
  dirs?: Set<string>;
  logs?: string[];
  errors?: string[];
  options?: IosRunOptions;
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
  --success-bg: #dcfce7;
  --success-text: #166534;
  --white: #ffffff;

  --dark-bg-primary: #0b0b11;
  --dark-fg-primary: #e9eaee;
  --dark-muted-fg: #9ca3af;
  --dark-primary: #6366f1;
  --dark-success-bg: #103424;
  --dark-success-fg: #c9f1dd;
  --dark-link: #9ecbff;
}`;
}

function buildRunLocalThis(initialFiles: Record<string, string> = {}): RunLocalThis {
  const localThis: RunLocalThis = {};
  localThis.files = new Map(Object.entries(initialFiles));
  localThis.written = new Map();
  localThis.unlinked = new Set();
  localThis.rmEmpty = new Set();
  localThis.dirs = new Set();
  localThis.logs = [];
  localThis.errors = [];
  localThis.options = {
    check: false,
    variablesCssPath: '/virt/variables.css',
    iosRoot: '/virt/ios',
    readFile: (p: string): string => {
      const v = localThis.files!.get(p);
      if (v === undefined) throw new Error(`readFile missing: ${p}`);
      return v;
    },
    existsFile: (p: string): boolean => localThis.files!.has(p),
    walkFiles: (dir: string): string[] => {
      const out: string[] = [];
      for (const k of localThis.files!.keys()) {
        if (k.startsWith(`${dir}/`)) out.push(k);
      }
      return out;
    },
    mkdirp: (p: string): void => {
      localThis.dirs!.add(p);
    },
    writeFile: (p: string, contents: string): void => {
      localThis.written!.set(p, contents);
      localThis.files!.set(p, contents);
    },
    unlinkFile: (p: string): void => {
      localThis.unlinked!.add(p);
      localThis.files!.delete(p);
    },
    rmEmptyDir: (p: string): void => {
      localThis.rmEmpty!.add(p);
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

describe('pairColorTokens', () => {
  it('pairs simple matches via the dark-<name> heuristic', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['muted-fg', '#4b5563'],
      ['dark-muted-fg', '#9ca3af'],
      ['primary', '#030213'],
      ['dark-primary', '#6366f1'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('muted-fg')).toEqual({
      light: '#4b5563',
      dark: '#9ca3af',
    });
    expect(localThis.result.pairs.get('primary')).toEqual({
      light: '#030213',
      dark: '#6366f1',
    });
    expect(localThis.result.consumedAsDark.has('dark-muted-fg')).toBe(true);
    expect(localThis.result.consumedAsDark.has('dark-primary')).toBe(true);
  });

  it('honours the bg -> dark-bg-primary override (NOT dark-bg, which is a separate "dark emphasis" semantic)', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['bg', '#ffffff'],
      ['dark-bg', '#f0d6d6'], // calc-dark / dark emphasis semantic; NOT the dark-mode counterpart of bg
      ['dark-bg-primary', '#0b0b11'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('bg')).toEqual({
      light: '#ffffff',
      dark: '#0b0b11',
    });
    expect(localThis.result.consumedAsDark.has('dark-bg-primary')).toBe(true);
    expect(localThis.result.consumedAsDark.has('dark-bg')).toBe(false);
    // dark-bg has its own pair entry (it's the light value of the "dark
    // emphasis" surface); without a dark-dark-bg in this input the pair
    // is light-only and the override warns about the missing target.
    expect(localThis.result.pairs.get('dark-bg')).toEqual({ light: '#f0d6d6' });
    expect(localThis.result.darkOnly.has('dark-bg')).toBe(false);
  });

  it('pairs dark-bg with dark-dark-bg (the calc-dark "dark emphasis" surface)', () => {
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
    // The dark counterparts must be folded into their pairs, not emitted as
    // separate standalone colorsets.
    expect(localThis.result.consumedAsDark.has('dark-dark-bg')).toBe(true);
    expect(localThis.result.consumedAsDark.has('dark-dark-fg')).toBe(true);
    expect(localThis.result.darkOnly.has('dark-dark-bg')).toBe(false);
    expect(localThis.result.darkOnly.has('dark-dark-fg')).toBe(false);
  });

  it('honours the success-text -> dark-success-fg override (asymmetric naming)', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['success-text', '#166534'],
      ['dark-success-fg', '#c9f1dd'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('success-text')).toEqual({
      light: '#166534',
      dark: '#c9f1dd',
    });
    expect(localThis.result.consumedAsDark.has('dark-success-fg')).toBe(true);
  });

  it('keeps NO_DARK_PAIR tokens (white, success, etc.) light-only without warning', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['white', '#ffffff'],
      ['success', '#15803d'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('white')).toEqual({ light: '#ffffff' });
    expect(localThis.result.pairs.get('success')).toEqual({ light: '#15803d' });
    expect(localThis.result.warnings).toEqual([]);
  });

  it('warns when a hard-coded override target is missing from DESIGN.md', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([['bg', '#ffffff']]); // dark-bg-primary absent
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.pairs.get('bg')).toEqual({ light: '#ffffff' });
    expect(
      localThis.result.warnings.some((w) =>
        w.includes('bg -> dark-bg-primary'),
      ),
    ).toBe(true);
  });

  it('emits unmatched dark-* tokens (e.g. dark-link) as standalone darkOnly entries', () => {
    const localThis: PairLocalThis = {};
    localThis.colors = new Map([
      ['bg', '#ffffff'],
      ['dark-bg-primary', '#0b0b11'],
      ['dark-link', '#9ecbff'],
    ]);
    localThis.result = pairColorTokens(localThis.colors);

    expect(localThis.result.darkOnly.get('dark-link')).toBe('#9ecbff');
    expect(localThis.result.darkOnly.has('dark-bg-primary')).toBe(false);
  });
});

describe('swiftIdentifier', () => {
  it('converts kebab-case to camelCase', () => {
    const localThis: IdentLocalThis = {};
    localThis.input = 'btn-primary-bg';
    localThis.output = swiftIdentifier(localThis.input);
    expect(localThis.output).toBe('btnPrimaryBg');
  });

  it('passes single-word identifiers through unchanged', () => {
    expect(swiftIdentifier('bg')).toBe('bg');
    expect(swiftIdentifier('display')).toBe('display');
  });

  it('escapes leading-digit names with an "s" prefix (Swift forbids leading digits)', () => {
    const localThis: IdentLocalThis = {};
    localThis.input = '1';
    localThis.output = swiftIdentifier(localThis.input);
    expect(localThis.output).toBe('s1');
    expect(swiftIdentifier('16')).toBe('s16');
  });
});

describe('buildColorsetContents', () => {
  it('emits a universal-only colorset when no dark hex is provided', () => {
    const localThis: ColorsetLocalThis = {};
    localThis.json = buildColorsetContents('#ffffff', undefined);
    localThis.parsed = JSON.parse(localThis.json) as ColorsetLocalThis['parsed'];

    expect(localThis.parsed!.colors).toHaveLength(1);
    const [light] = localThis.parsed!.colors as Array<Record<string, unknown>>;
    expect(light).toMatchObject({ idiom: 'universal' });
    expect(light).not.toHaveProperty('appearances');
  });

  it('emits both universal and dark-appearance entries when a dark hex is provided', () => {
    const localThis: ColorsetLocalThis = {};
    localThis.json = buildColorsetContents('#ffffff', '#0b0b11');
    localThis.parsed = JSON.parse(localThis.json) as ColorsetLocalThis['parsed'];

    expect(localThis.parsed!.colors).toHaveLength(2);
    const [, dark] = localThis.parsed!.colors as Array<Record<string, unknown>>;
    expect(dark).toMatchObject({
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
    });
  });

  it('converts hex to sRGB component floats with 3 decimal places', () => {
    const json = buildColorsetContents('#ff8040', undefined);
    const parsed = JSON.parse(json) as {
      colors: Array<{
        color: { 'color-space': string; components: Record<string, string> };
      }>;
    };
    const c = parsed.colors[0]!.color;
    expect(c['color-space']).toBe('srgb');
    expect(c.components.red).toBe('1.000');
    expect(c.components.green).toBe('0.502');
    expect(c.components.blue).toBe('0.251');
    expect(c.components.alpha).toBe('1.000');
  });

  it('records the generator script as the colorset author for traceability', () => {
    const json = buildColorsetContents('#ffffff', undefined);
    const parsed = JSON.parse(json) as { info: { author: string } };
    expect(parsed.info.author).toBe('web/scripts/export-ios-tokens.ts');
  });
});

describe('buildNamespaceContents', () => {
  it('marks the DS folder as an asset-catalog namespace so colors live under DS/<name>', () => {
    const json = buildNamespaceContents();
    const parsed = JSON.parse(json) as {
      properties: { 'provides-namespace': boolean };
    };
    expect(parsed.properties['provides-namespace']).toBe(true);
  });
});

describe('buildIosArtifacts', () => {
  it('emits one Swift file plus one Contents.json per token (light or dark-only) plus the namespace', () => {
    const localThis: ArtifactsLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.artifacts = buildIosArtifacts(localThis.parsed);

    expect(localThis.artifacts.swift).toContain('public enum DS {');
    expect(localThis.artifacts.colorsets.has('Assets.xcassets/DS/Contents.json')).toBe(true);
    // Sample CSS: bg, fg, muted-fg, primary, success-bg, success-text, white,
    // and one stand-alone dark-link. dark-* counterparts that pair are folded.
    const colorsetPaths = [...localThis.artifacts.colorsets.keys()].filter(
      (p) => p.endsWith('.colorset/Contents.json'),
    );
    expect(colorsetPaths).toHaveLength(8);
    expect(
      localThis.artifacts.colorsets.has(
        'Assets.xcassets/DS/dark-link.colorset/Contents.json',
      ),
    ).toBe(true);
    // Folded dark counterparts should NOT have their own colorset.
    expect(
      localThis.artifacts.colorsets.has(
        'Assets.xcassets/DS/dark-muted-fg.colorset/Contents.json',
      ),
    ).toBe(false);
  });

  it('renders Swift Color references using the DS/<original-name> path', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);

    expect(swift).toContain('SwiftUI.Color("DS/bg", bundle: .main)');
    expect(swift).toContain('SwiftUI.Color("DS/muted-fg", bundle: .main)');
    expect(swift).toContain('public static let mutedFg ='); // identifier camelCased
  });

  it('renders typography levels with pre-computed additive lineSpacing for SwiftUI', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);

    // display: fontSize 48, lineHeight 1.1 -> additive = (1.1 - 1) * 48 = 4.8
    expect(swift).toMatch(/display = Level\([\s\S]*?lineSpacing: 4\.8/);
    // bodyMd: fontSize 16, lineHeight 1.5 -> additive = 0.5 * 16 = 8
    expect(swift).toMatch(/bodyMd = Level\([\s\S]*?lineSpacing: 8/);
  });

  it('renders display.letterSpacing as -0.96 (CSS -0.02em x 48px)', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);
    expect(swift).toMatch(/display = Level\([\s\S]*?letterSpacing: -0\.96/);
  });

  it('renders typography levels using Font.custom("Work Sans", size:).weight(...) so the bundled variable font is picked up', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);
    expect(swift).toContain(
      'font: SwiftUI.Font.custom("Work Sans", size: 48).weight(.bold)',
    );
    expect(swift).toContain(
      'font: SwiftUI.Font.custom("Work Sans", size: 16).weight(.regular)',
    );
    expect(swift).toContain(
      'font: SwiftUI.Font.custom("Work Sans", size: 12).weight(.medium)',
    );
    // Guard against a regression to Font.system.
    expect(swift).not.toContain('Font.system(size:');
  });

  it('renders typography levels without letterSpacing as nil', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);
    expect(swift).toMatch(/h1 = Level\([\s\S]*?letterSpacing: nil/);
  });

  it('exposes spacing keys with leading-digit names as s1..sN', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);
    expect(swift).toContain('public static let s1: CoreGraphics.CGFloat = 4');
    expect(swift).toContain('public static let s4: CoreGraphics.CGFloat = 16');
  });

  it('exposes the radius scale as named CGFloats', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const { swift } = buildIosArtifacts(parsed);
    expect(swift).toContain('public static let sm: CoreGraphics.CGFloat = 4');
    expect(swift).toContain('public static let full: CoreGraphics.CGFloat = 9999');
  });
});

describe('runIosExport', () => {
  it('writes the Swift file plus all colorsets to the iosRoot in write mode', () => {
    const localThis = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    localThis.options!.check = false;

    localThis.code = runIosExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(
      localThis.written!.has('/virt/ios/DesignSystem/Tokens.swift'),
    ).toBe(true);
    expect(
      localThis.written!.has('/virt/ios/Assets.xcassets/DS/Contents.json'),
    ).toBe(true);
    expect(
      localThis.written!.has('/virt/ios/Assets.xcassets/DS/bg.colorset/Contents.json'),
    ).toBe(true);
  });

  it('returns 0 in --check mode (smoke test) without writing anything to disk', () => {
    const localThis = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    localThis.options!.check = true;

    localThis.code = runIosExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.written!.size).toBe(0);
    expect(
      localThis.logs!.some((l) =>
        l.includes('iOS design tokens generator runs cleanly'),
      ),
    ).toBe(true);
  });

  it('returns 1 in --check mode if the generator would emit empty output (canary for a malformed shared/DESIGN.md)', () => {
    const localThis = buildRunLocalThis({
      // CSS with no tokens: parseCssVariables returns empty, so colorsets
      // is empty. Should fail.
      '/virt/variables.css': ':root {}',
    });
    localThis.options!.check = true;

    localThis.code = runIosExport(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) =>
        e.includes('iOS exporter produced 0 token colorsets'),
      ),
    ).toBe(true);
  });

  it('prunes stale colorsets in write mode', () => {
    const initial = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    runIosExport(initial.options!);

    const stalePath =
      '/virt/ios/Assets.xcassets/DS/old-token.colorset/Contents.json';
    const localThis = buildRunLocalThis({
      '/virt/variables.css': sampleCss(),
      ...Object.fromEntries(initial.written!),
      [stalePath]: '{}',
    });

    localThis.code = runIosExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.unlinked!.has(stalePath)).toBe(true);
    expect(
      localThis.rmEmpty!.has(
        '/virt/ios/Assets.xcassets/DS/old-token.colorset',
      ),
    ).toBe(true);
  });
});
