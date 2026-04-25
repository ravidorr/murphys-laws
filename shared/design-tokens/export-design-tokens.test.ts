import { describe, it, expect } from 'vitest';
import {
  buildDtcgDocument,
  rewriteDesignMdRef,
  inferDtcgType,
  runExport,
  type DtcgDocument,
  type DtcgGroup,
  type DtcgLeafToken,
  type ExportRunOptions,
} from './export-design-tokens.ts';
import {
  classifyTokens,
  parseCssVariables,
  type ClassifiedTokens,
} from './sync-design-tokens.ts';

interface BuildLocalThis {
  parsed?: ClassifiedTokens;
  doc?: DtcgDocument;
}

interface RewriteLocalThis {
  input?: string;
  rewritten?: string;
}

interface InferLocalThis {
  type?: string;
}

interface RunExportLocalThis {
  files?: Map<string, string>;
  dirs?: Set<string>;
  written?: Map<string, string>;
  logs?: string[];
  errors?: string[];
  options?: ExportRunOptions;
  code?: 0 | 1;
}

function sampleCss(): string {
  return `:root {
  --space-1: 0.25rem;
  --space-4: 1rem;
  --bg: #ffffff;
  --fg: #111827;
  --primary: #030213;
}`;
}

function buildRunExportLocalThis(
  initialFiles: Record<string, string> = {},
): RunExportLocalThis {
  const localThis: RunExportLocalThis = {};
  localThis.files = new Map(Object.entries(initialFiles));
  localThis.dirs = new Set();
  localThis.written = new Map();
  localThis.logs = [];
  localThis.errors = [];
  localThis.options = {
    variablesCssPath: '/virt/variables.css',
    outputPath: '/virt/.design-exports/design-tokens.dtcg.json',
    readFile: (p: string): string => {
      const value = localThis.files!.get(p);
      if (value === undefined) {
        throw new Error(`readFile missing: ${p}`);
      }
      return value;
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

describe('buildDtcgDocument', () => {
  it('emits color / dimension / typography / component groups in DTCG shape', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    expect(localThis.doc.$schema).toContain('design-tokens');
    expect(localThis.doc.color).toBeDefined();
    expect(localThis.doc.dimension).toBeDefined();
    expect(localThis.doc.typography).toBeDefined();
    expect(localThis.doc.component).toBeDefined();
  });

  it('emits each color as a leaf with $value (hex) and $type "color"', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const bg = localThis.doc.color['bg'] as DtcgLeafToken;
    expect(bg.$value).toBe('#ffffff');
    expect(bg.$type).toBe('color');

    const primary = localThis.doc.color['primary'] as DtcgLeafToken;
    expect(primary.$value).toBe('#030213');
    expect(primary.$type).toBe('color');
  });

  it('emits spacing and radius under dimension.* as dimension tokens', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const dim = localThis.doc.dimension as DtcgGroup;
    const spacing = dim['spacing'] as DtcgGroup;
    const radius = dim['radius'] as DtcgGroup;

    expect((spacing['1'] as DtcgLeafToken).$value).toBe('4px');
    expect((spacing['1'] as DtcgLeafToken).$type).toBe('dimension');
    expect((spacing['4'] as DtcgLeafToken).$value).toBe('16px');

    expect((radius['sm'] as DtcgLeafToken).$value).toBe('4px');
    expect((radius['sm'] as DtcgLeafToken).$type).toBe('dimension');
    expect((radius['full'] as DtcgLeafToken).$value).toBe('9999px');
  });

  it('emits typography levels as composite $type "typography" tokens', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const display = localThis.doc.typography['display'] as DtcgLeafToken;
    expect(display.$type).toBe('typography');
    const value = display.$value as Record<string, string | number>;
    expect(value.fontFamily).toBe('Work Sans, system-ui');
    expect(value.fontSize).toBe('48px');
    expect(value.fontWeight).toBe(700);
    expect(value.lineHeight).toBe(1.1);
    expect(value.letterSpacing).toBe('-0.02em');
  });

  it('omits letterSpacing when absent from the source typography level', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const h1 = localThis.doc.typography['h1'] as DtcgLeafToken;
    const value = h1.$value as Record<string, string | number>;
    expect(value.letterSpacing).toBeUndefined();
  });

  it('preserves component entries as DTCG references pointing at base tokens', () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const btnPrimary = localThis.doc.component['btn-primary'] as DtcgGroup;
    const bg = btnPrimary['backgroundColor'] as DtcgLeafToken;
    expect(bg.$value).toBe('{color.btn-primary-bg}');
    expect(bg.$type).toBe('color');

    const rounded = btnPrimary['rounded'] as DtcgLeafToken;
    expect(rounded.$value).toBe('{dimension.radius.md}');
    expect(rounded.$type).toBe('dimension');

    const typography = btnPrimary['typography'] as DtcgLeafToken;
    expect(typography.$value).toBe('{typography.body-md}');
    expect(typography.$type).toBe('typography');
  });

  it('round-trips every entry from the sync script COMPONENTS map', async () => {
    const localThis: BuildLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.doc = buildDtcgDocument(localThis.parsed);

    const { COMPONENTS } = await import('./sync-design-tokens.ts');
    for (const name of Object.keys(COMPONENTS)) {
      expect(localThis.doc.component[name]).toBeDefined();
    }
  });
});

describe('rewriteDesignMdRef', () => {
  it('rewrites {colors.*} into DTCG {color.*}', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '{colors.btn-primary-bg}';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('{color.btn-primary-bg}');
  });

  it('nests {rounded.*} under dimension.radius', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '{rounded.md}';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('{dimension.radius.md}');
  });

  it('nests {spacing.*} under dimension.spacing', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '{spacing.4}';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('{dimension.spacing.4}');
  });

  it('leaves {typography.*} untouched (already at the DTCG root path)', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '{typography.body-md}';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('{typography.body-md}');
  });

  it('passes through non-reference values (literal dimensions etc.)', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '24px';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('24px');
  });

  it('passes through references to unknown categories unchanged', () => {
    const localThis: RewriteLocalThis = {};
    localThis.input = '{elevation.card}';
    localThis.rewritten = rewriteDesignMdRef(localThis.input);

    expect(localThis.rewritten).toBe('{elevation.card}');
  });
});

describe('inferDtcgType', () => {
  it('maps any prop with "color" in the name to $type "color"', () => {
    const localThis: InferLocalThis = {};
    localThis.type = inferDtcgType('backgroundColor', '{colors.bg}');
    expect(localThis.type).toBe('color');

    expect(inferDtcgType('textColor', '{colors.fg}')).toBe('color');
    expect(inferDtcgType('borderColor', '#000')).toBe('color');
  });

  it('maps "rounded" / "radius" to $type "dimension"', () => {
    expect(inferDtcgType('rounded', '{rounded.md}')).toBe('dimension');
    expect(inferDtcgType('radius', '{rounded.md}')).toBe('dimension');
  });

  it('maps "typography" to $type "typography"', () => {
    expect(inferDtcgType('typography', '{typography.body-md}')).toBe(
      'typography',
    );
  });

  it('maps literal pixel widths and heights to $type "dimension"', () => {
    expect(inferDtcgType('width', '24px')).toBe('dimension');
    expect(inferDtcgType('height', '44px')).toBe('dimension');
    expect(inferDtcgType('fontSize', '16px')).toBe('dimension');
  });

  it('falls back to "other" for unknown props', () => {
    const localThis: InferLocalThis = {};
    localThis.type = inferDtcgType('mysteryProp', '{colors.bg}');
    expect(localThis.type).toBe('other');

    expect(inferDtcgType('anotherProp', 'literal-string')).toBe('other');
  });
});

describe('runExport', () => {
  it('writes a JSON file at the configured output path', () => {
    const localThis = buildRunExportLocalThis({
      '/virt/variables.css': sampleCss(),
    });

    localThis.code = runExport(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(
      localThis.written!.has('/virt/.design-exports/design-tokens.dtcg.json'),
    ).toBe(true);
    const written = localThis.written!.get(
      '/virt/.design-exports/design-tokens.dtcg.json',
    )!;
    const parsed = JSON.parse(written) as DtcgDocument;
    expect(parsed.$schema).toContain('design-tokens');
    expect((parsed.color['bg'] as DtcgLeafToken).$value).toBe('#ffffff');
  });

  it('ensures the parent directory exists before writing', () => {
    const localThis = buildRunExportLocalThis({
      '/virt/variables.css': sampleCss(),
    });

    runExport(localThis.options!);

    expect(localThis.dirs!.has('/virt/.design-exports')).toBe(true);
  });

  it('logs a user-visible "Wrote <path>" success line', () => {
    const localThis = buildRunExportLocalThis({
      '/virt/variables.css': sampleCss(),
    });

    runExport(localThis.options!);

    expect(
      localThis.logs!.some((l) => l.includes('Wrote /virt/.design-exports/')),
    ).toBe(true);
  });

  it('returns 1 with a helpful error when variables.css is missing', () => {
    const localThis = buildRunExportLocalThis({});

    localThis.code = runExport(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) =>
        e.includes('/virt/variables.css not found'),
      ),
    ).toBe(true);
    expect(localThis.written!.size).toBe(0);
  });
});
