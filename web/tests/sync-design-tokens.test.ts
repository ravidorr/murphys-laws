import { describe, it, expect } from 'vitest';
import {
  parseCssVariables,
  classifyTokens,
  renderFrontMatter,
  buildDesignMd,
  extractBody,
  run,
  type ClassifiedTokens,
  type RunOptions,
} from '../scripts/sync-design-tokens.ts';

interface ParseLocalThis {
  css?: string;
  parsed?: Map<string, string>;
}

interface ClassifyLocalThis {
  vars?: Map<string, string>;
  classified?: ClassifiedTokens;
}

interface RenderLocalThis {
  parsed?: ClassifiedTokens;
  yaml?: string;
}

interface RunLocalThis {
  files?: Map<string, string>;
  written?: Map<string, string>;
  logs?: string[];
  errors?: string[];
  options?: RunOptions;
  code?: 0 | 1;
}

function sampleCss(): string {
  return `:root {
  /* Spacing scale */
  --space-1: 0.25rem;   /* 4px */
  --space-4: 1rem;      /* 16px */
  --space-16: 4rem;     /* 64px */

  /* Colors - hex OK */
  --bg: #fff;
  --fg: #111827;
  --primary: #030213;

  /* Color - rgba is intentionally ignored (DESIGN.md requires #HEX) */
  --border: rgb(0 0 0 / 25%);

  /* Color - color-mix / var refs are ignored */
  --hover: color-mix(in oklab, var(--bg) 90%, black 10%);
  --other: var(--bg);

  /* Typography primitives - not color, not space-*, classified elsewhere */
  --text-xs: 0.75rem;
  --font-normal: 400;
}`;
}

function buildRunLocalThis(initialFiles: Record<string, string> = {}): RunLocalThis {
  const localThis: RunLocalThis = {};
  localThis.files = new Map(Object.entries(initialFiles));
  localThis.written = new Map();
  localThis.logs = [];
  localThis.errors = [];
  localThis.options = {
    check: false,
    variablesCssPath: '/virt/variables.css',
    designMdPath: '/virt/DESIGN.md',
    readFile: (p: string): string => {
      const value = localThis.files!.get(p);
      if (value === undefined) {
        throw new Error(`readFile missing: ${p}`);
      }
      return value;
    },
    existsFile: (p: string): boolean => localThis.files!.has(p),
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

describe('parseCssVariables', () => {
  it('extracts --name: value pairs from :root block', () => {
    const localThis: ParseLocalThis = {};
    localThis.css = sampleCss();
    localThis.parsed = parseCssVariables(localThis.css);

    expect(localThis.parsed.get('space-1')).toBe('0.25rem');
    expect(localThis.parsed.get('space-4')).toBe('1rem');
    expect(localThis.parsed.get('space-16')).toBe('4rem');
    expect(localThis.parsed.get('bg')).toBe('#fff');
    expect(localThis.parsed.get('fg')).toBe('#111827');
    expect(localThis.parsed.get('border')).toBe('rgb(0 0 0 / 25%)');
    expect(localThis.parsed.get('hover')).toBe(
      'color-mix(in oklab, var(--bg) 90%, black 10%)',
    );
  });

  it('strips /* ... */ comments so they cannot be misread as declarations', () => {
    const localThis: ParseLocalThis = {};
    localThis.css =
      ':root {\n  /* --fake: #000; */\n  --real: #abc;\n}';
    localThis.parsed = parseCssVariables(localThis.css);

    expect(localThis.parsed.has('fake')).toBe(false);
    expect(localThis.parsed.get('real')).toBe('#abc');
  });

  it('returns an empty map when there is no :root block', () => {
    const localThis: ParseLocalThis = {};
    localThis.css = 'body { color: red; }';
    localThis.parsed = parseCssVariables(localThis.css);

    expect(localThis.parsed.size).toBe(0);
  });
});

describe('classifyTokens', () => {
  it('keeps only hex colors, normalizing shorthand, and rejects rgba / color-mix / var refs', () => {
    const localThis: ClassifyLocalThis = {};
    localThis.vars = parseCssVariables(sampleCss());
    localThis.classified = classifyTokens(localThis.vars);

    expect(localThis.classified.colors.get('bg')).toBe('#ffffff');
    expect(localThis.classified.colors.get('fg')).toBe('#111827');
    expect(localThis.classified.colors.get('primary')).toBe('#030213');
    expect(localThis.classified.colors.has('border')).toBe(false);
    expect(localThis.classified.colors.has('hover')).toBe(false);
    expect(localThis.classified.colors.has('other')).toBe(false);
    expect(localThis.classified.colors.has('text-xs')).toBe(false);
    expect(localThis.classified.colors.has('font-normal')).toBe(false);
  });

  it('emits spacing values in px, converting from rem via 16px base', () => {
    const localThis: ClassifyLocalThis = {};
    localThis.vars = parseCssVariables(sampleCss());
    localThis.classified = classifyTokens(localThis.vars);

    expect(localThis.classified.spacing.get('1')).toBe('4px');
    expect(localThis.classified.spacing.get('4')).toBe('16px');
    expect(localThis.classified.spacing.get('16')).toBe('64px');
  });

  it('accepts px values directly in --space-* and preserves them', () => {
    const localThis: ClassifyLocalThis = {};
    localThis.vars = new Map([['space-2', '8px']]);
    localThis.classified = classifyTokens(localThis.vars);

    expect(localThis.classified.spacing.get('2')).toBe('8px');
  });

  it('drops --space-* values in unsupported units (e.g. em)', () => {
    const localThis: ClassifyLocalThis = {};
    localThis.vars = new Map([['space-3', '1em']]);
    localThis.classified = classifyTokens(localThis.vars);

    expect(localThis.classified.spacing.has('3')).toBe(false);
  });
});

describe('renderFrontMatter', () => {
  it('emits a stable, DESIGN.md-shaped YAML front matter', () => {
    const localThis: RenderLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.yaml = renderFrontMatter(localThis.parsed);

    expect(localThis.yaml.startsWith('version: alpha\n')).toBe(true);
    expect(localThis.yaml).toContain('name: "Murphy\'s Law Archive"');
    expect(localThis.yaml).toContain('colors:');
    expect(localThis.yaml).toContain('  bg: "#ffffff"');
    expect(localThis.yaml).toContain('  primary: "#030213"');
    expect(localThis.yaml).toContain('typography:');
    expect(localThis.yaml).toContain('  display:');
    expect(localThis.yaml).toContain('rounded:');
    expect(localThis.yaml).toContain('  full: "9999px"');
    expect(localThis.yaml).toContain('spacing:');
    expect(localThis.yaml).toContain('  "1": "4px"');
    expect(localThis.yaml).toContain('components:');
    expect(localThis.yaml).toContain('  btn-primary:');
    expect(localThis.yaml).toContain(
      '    backgroundColor: "{colors.btn-primary-bg}"',
    );
  });

  it('includes the chrome components that AI agents most often regenerate', () => {
    const localThis: RenderLocalThis = {};
    localThis.parsed = classifyTokens(parseCssVariables(sampleCss()));
    localThis.yaml = renderFrontMatter(localThis.parsed);

    // Anchored on the two-space YAML indent so we match component keys
    // (not stray substrings inside token refs like {colors.bg}).
    expect(localThis.yaml).toContain('\n  notification:\n');
    expect(localThis.yaml).toContain('\n  header:\n');
    expect(localThis.yaml).toContain('\n  footer:\n');
    expect(localThis.yaml).toContain('\n  breadcrumb:\n');
    expect(localThis.yaml).toContain('\n  search-autocomplete:\n');

    expect(localThis.yaml).toContain(
      '  search-autocomplete:\n    backgroundColor: "{colors.bg}"\n    textColor: "{colors.fg}"\n    rounded: "{rounded.lg}"\n    typography: "{typography.body-md}"',
    );
  });

  it('appends author-added colors alphabetically after the canonical order', () => {
    const localThis: RenderLocalThis = {};
    localThis.parsed = {
      colors: new Map([
        ['bg', '#ffffff'],
        ['zeta-extra', '#123456'],
        ['alpha-extra', '#654321'],
      ]),
      spacing: new Map(),
    };
    localThis.yaml = renderFrontMatter(localThis.parsed);

    const idxBg = localThis.yaml.indexOf('  bg: ');
    const idxAlpha = localThis.yaml.indexOf('  alpha-extra: ');
    const idxZeta = localThis.yaml.indexOf('  zeta-extra: ');
    expect(idxBg).toBeGreaterThanOrEqual(0);
    expect(idxAlpha).toBeGreaterThan(idxBg);
    expect(idxZeta).toBeGreaterThan(idxAlpha);
  });

  it('quotes YAML keys that are not safe bare identifiers', () => {
    const localThis: RenderLocalThis = {};
    localThis.parsed = {
      colors: new Map(),
      spacing: new Map([['1', '4px']]),
    };
    localThis.yaml = renderFrontMatter(localThis.parsed);

    expect(localThis.yaml).toContain('  "1": "4px"');
  });
});

describe('extractBody', () => {
  it('falls back to the default body when no file exists', () => {
    expect(extractBody(undefined)).toContain("# Murphy's Law Archive");
  });

  it('falls back to the default body when the YAML block is empty/missing', () => {
    expect(extractBody('')).toContain("# Murphy's Law Archive");
  });

  it('returns the body unchanged when front matter is present', () => {
    const file = '---\nversion: alpha\n---\n# Custom body\n\nHello.';
    expect(extractBody(file)).toBe('# Custom body\n\nHello.');
  });

  it('returns existing content as-is when it has no front matter', () => {
    const file = '# Just a body\n\nNo front matter here.';
    expect(extractBody(file)).toBe('# Just a body\n\nNo front matter here.');
  });
});

describe('buildDesignMd', () => {
  it('glues front matter and preserved body with the expected delimiters', () => {
    const parsed = classifyTokens(parseCssVariables(sampleCss()));
    const existing = '---\nversion: old\n---\n# Preserved\n';
    const next = buildDesignMd({ existingContent: existing, parsed });

    expect(next.startsWith('---\nversion: alpha\n')).toBe(true);
    expect(next).toMatch(/\n---\n# Preserved\n$/);
  });
});

describe('run', () => {
  it('writes DESIGN.md on first run when the file is missing', () => {
    const localThis = buildRunLocalThis({
      '/virt/variables.css': sampleCss(),
    });
    localThis.options!.check = false;

    localThis.code = run(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.written!.has('/virt/DESIGN.md')).toBe(true);
    expect(localThis.written!.get('/virt/DESIGN.md')!.startsWith('---\n')).toBe(true);
    expect(localThis.logs!.some((l) => l.includes('Wrote /virt/DESIGN.md'))).toBe(
      true,
    );
  });

  it('in --check mode returns 0 when the file is already in sync', () => {
    const initial = buildRunLocalThis({ '/virt/variables.css': sampleCss() });
    run(initial.options!);

    const localThis = buildRunLocalThis({
      '/virt/variables.css': sampleCss(),
      '/virt/DESIGN.md': initial.written!.get('/virt/DESIGN.md')!,
    });
    localThis.options!.check = true;
    localThis.code = run(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.written!.size).toBe(0);
    expect(
      localThis.logs!.some((l) => l.includes('DESIGN.md is in sync')),
    ).toBe(true);
  });

  it('in --check mode returns 1 and logs an error when the file is out of sync', () => {
    const localThis = buildRunLocalThis({
      '/virt/variables.css': sampleCss(),
      '/virt/DESIGN.md': '---\nversion: alpha\n---\n# stale\n',
    });
    localThis.options!.check = true;

    localThis.code = run(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) =>
        e.includes('DESIGN.md is out of sync'),
      ),
    ).toBe(true);
    expect(localThis.written!.size).toBe(0);
  });

  it('in write mode rewrites the front matter while preserving the body', () => {
    const localThis = buildRunLocalThis({
      '/virt/variables.css': sampleCss(),
      '/virt/DESIGN.md':
        '---\nversion: old\nname: "stale"\n---\n# Kept body\n\nContent.\n',
    });
    localThis.options!.check = false;

    localThis.code = run(localThis.options!);

    const written = localThis.written!.get('/virt/DESIGN.md')!;
    expect(localThis.code).toBe(0);
    expect(written).toContain('version: alpha');
    expect(written).toMatch(/\n---\n# Kept body\n\nContent\.\n$/);
  });
});
