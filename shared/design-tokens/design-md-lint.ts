import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildComponents,
  classifyTokens,
  parseCssVariables,
  renderFrontMatter,
  TYPOGRAPHY_LEVELS,
  type ClassifiedTokens,
} from './sync-design-tokens.ts';

export interface DesignFinding {
  severity: 'error' | 'info';
  path?: string;
  message: string;
}

const REQUIRED_DOCUMENTATION = [
  { path: 'documentation.components', pattern: /^## Components$/m },
  { path: 'documentation.states', pattern: /^### States$/m },
  { path: 'documentation.semantic-colors', pattern: /semantic color tokens/i },
  { path: 'documentation.typography', pattern: /^## Typography$/m },
  { path: 'documentation.motion', pattern: /transitions and animations/i },
  {
    path: 'documentation.reduced-motion',
    pattern: /prefers-reduced-motion:\s*reduce/i,
  },
  { path: 'documentation.accessibility', pattern: /Accessibility is non-negotiable/i },
];

function resolveColorReference(
  value: string,
  parsed: ClassifiedTokens,
): string | undefined {
  const match = value.match(/^\{colors\.([a-z0-9-]+)\}$/i);
  return match?.[1] ? parsed.colors.get(match[1]) : undefined;
}

function parseHex(value: string): [number, number, number, number] | undefined {
  const match = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (!match?.[1]) return undefined;
  const rgb = match[1];
  return [
    Number.parseInt(rgb.slice(0, 2), 16),
    Number.parseInt(rgb.slice(2, 4), 16),
    Number.parseInt(rgb.slice(4, 6), 16),
    match[2] ? Number.parseInt(match[2], 16) / 255 : 1,
  ];
}

function composite(
  foreground: [number, number, number, number],
  background: [number, number, number, number],
): [number, number, number] {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  return [0, 1, 2].map((channel) => {
    const value =
      (foreground[channel]! * foreground[3] +
        background[channel]! * background[3] * (1 - foreground[3])) /
      alpha;
    return value;
  }) as [number, number, number];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(
  foreground: string,
  background: string,
  canvas = '#ffffff',
): number | undefined {
  const foregroundRgba = parseHex(foreground);
  const backgroundRgba = parseHex(background);
  const canvasRgba = parseHex(canvas);
  if (!foregroundRgba || !backgroundRgba || !canvasRgba) return undefined;

  const opaqueBackground = composite(backgroundRgba, canvasRgba);
  const opaqueForeground = composite(foregroundRgba, [
    ...opaqueBackground,
    1,
  ]);
  const light = relativeLuminance(opaqueForeground);
  const dark = relativeLuminance(opaqueBackground);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

function typographyMinimum(reference: string | undefined): number {
  const match = reference?.match(/^\{typography\.([a-z0-9-]+)\}$/i);
  const typography = match?.[1] ? TYPOGRAPHY_LEVELS[match[1]] : undefined;
  if (!typography) return 4.5;
  const pixels = Number.parseFloat(typography.fontSize);
  const isLarge =
    pixels >= 24 || (pixels >= 18.66 && typography.fontWeight >= 700);
  return isLarge ? 3 : 4.5;
}

export function validateDesignSystem(
  designMd: string,
  variablesCss: string,
): DesignFinding[] {
  const findings: DesignFinding[] = [];
  const parsed = classifyTokens(parseCssVariables(variablesCss));
  const frontMatter = designMd.match(/^---\n([\s\S]*?)---\n/);

  if (!frontMatter?.[1]) {
    findings.push({
      severity: 'error',
      path: 'front-matter',
      message: 'DESIGN.md must start with generated YAML front matter.',
    });
  } else if (frontMatter[1] !== renderFrontMatter(parsed)) {
    findings.push({
      severity: 'error',
      path: 'front-matter',
      message: 'DESIGN.md front matter has drifted from variables.css.',
    });
  }

  for (const required of REQUIRED_DOCUMENTATION) {
    if (!required.pattern.test(designMd)) {
      findings.push({
        severity: 'error',
        path: required.path,
        message: `Missing required design-system documentation: ${required.path}.`,
      });
    }
  }

  for (const [name, value] of parsed.colors) {
    if (!parseHex(value)) {
      findings.push({
        severity: 'error',
        path: `colors.${name}`,
        message: `${value} is not a six- or eight-digit sRGB hex color.`,
      });
    }
  }

  const components = buildComponents(parsed);
  for (const [name, properties] of Object.entries(components)) {
    const background = properties.backgroundColor
      ? resolveColorReference(properties.backgroundColor, parsed)
      : undefined;
    const foreground = properties.textColor
      ? resolveColorReference(properties.textColor, parsed)
      : undefined;

    if (properties.backgroundColor && !background) {
      findings.push({
        severity: 'error',
        path: `components.${name}.backgroundColor`,
        message: `Unknown color reference ${properties.backgroundColor}.`,
      });
    }
    if (properties.textColor && !foreground) {
      findings.push({
        severity: 'error',
        path: `components.${name}.textColor`,
        message: `Unknown color reference ${properties.textColor}.`,
      });
    }
    if (!background || !foreground) continue;

    const ratio = contrastRatio(foreground, background);
    const minimum = typographyMinimum(properties.typography);
    if (ratio !== undefined && ratio < minimum) {
      findings.push({
        severity: 'error',
        path: `components.${name}`,
        message: `Contrast ${ratio.toFixed(2)}:1 is below WCAG AA minimum ${minimum}:1.`,
      });
    }
  }

  findings.push({
    severity: 'info',
    message: `Design system defines ${parsed.colors.size} colors, ${Object.keys(TYPOGRAPHY_LEVELS).length} typography scales, ${parsed.rounded.size} rounding levels, ${parsed.spacing.size} spacing tokens, ${Object.keys(components).length} components.`,
  });
  return findings;
}

export interface RunLintOptions {
  designMdPath: string;
  variablesCssPath: string;
  existsFile: (file: string) => boolean;
  readFile: (file: string) => string;
  logger: Pick<Console, 'log' | 'error'>;
}

export function runDesignMdLint(options: RunLintOptions): 0 | 1 {
  for (const file of [options.designMdPath, options.variablesCssPath]) {
    if (!options.existsFile(file)) {
      options.logger.error(`design.md lint failed: ${file} not found.`);
      return 1;
    }
  }

  const findings = validateDesignSystem(
    options.readFile(options.designMdPath),
    options.readFile(options.variablesCssPath),
  );
  for (const finding of findings) {
    const message = `${finding.path ? `${finding.path}: ` : ''}${finding.message}`;
    if (finding.severity === 'error') options.logger.error(`error ${message}`);
    else options.logger.log(`info  ${message}`);
  }

  const errors = findings.filter((finding) => finding.severity === 'error').length;
  options.logger.log(`design.md lint: ${errors} error(s).`);
  return errors === 0 ? 0 : 1;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === new URL(`file://${entry}`).href);
}

if (isMain()) {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  process.exit(
    runDesignMdLint({
      designMdPath: path.resolve(directory, '../../web/DESIGN.md'),
      variablesCssPath: path.resolve(
        directory,
        '../../web/styles/partials/variables.css',
      ),
      existsFile: fs.existsSync,
      readFile: (file) => fs.readFileSync(file, 'utf8'),
      logger: console,
    }),
  );
}
