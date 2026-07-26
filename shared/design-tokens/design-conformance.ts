import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ConformanceRule =
  | 'react-package'
  | 'react-source'
  | 'jsx-runtime'
  | 'inline-css'
  | 'stylesheet-injection'
  | 'untokenized-css'
  | 'untokenized-component-size'
  | 'raw-native-presentation'
  | 'ui-emoji'
  | 'design-system-wiring';

export interface ConformanceViolation {
  file: string;
  line: number;
  rule: ConformanceRule;
  message: string;
}

const SOURCE_EXTENSIONS = new Set([
  '.html',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.sh',
  '.swift',
]);

const WALK_EXCLUSIONS = new Set([
  '.git',
  '.context',
  'node_modules',
  'build',
  '.gradle',
  'DerivedData',
  'coverage',
]);

const INLINE_SOURCE_ROOTS = [
  'web/index.html',
  'web/public',
  'web/src',
  'web/scripts',
  'shared/modules',
  'backend/src',
  'backend/scripts',
  'ios/MurphysLaws',
];

const CSS_ROOTS = ['web/styles', 'web/public/styles'];
const CSS_TOKEN_DEFINITION = 'web/styles/partials/variables.css';
const CSS_PRINT_ALLOWLIST = 'web/styles/partials/print.css';
const IOS_EXPORT_COMMAND = 'tsx shared/design-tokens/export-ios-tokens.ts';
const IOS_PROJECT_EXPORT_COMMAND =
  'npm --prefix .. run design:export:ios';
const CI_WORKFLOW_CONTRACTS: Record<
  string,
  {
    label: string;
    paths: string[];
    commands: string[];
  }
> = {
  '.github/workflows/android-ci.yml': {
    label: 'Android',
    paths: [
      'android/**',
      'shared/DESIGN.md',
      'shared/design-tokens/**',
      'web/DESIGN.md',
      'web/styles/partials/variables.css',
      '.github/workflows/android-ci.yml',
    ],
    commands: [
      'run: npm run design:conformance',
      'run: npm run design:export:android',
      'connectedDebugAndroidTest',
    ],
  },
  '.github/workflows/ios-ci.yml': {
    label: 'iOS',
    paths: [
      'ios/**',
      'shared/DESIGN.md',
      'shared/design-tokens/**',
      'web/DESIGN.md',
      'web/styles/partials/variables.css',
      '.github/workflows/ios-ci.yml',
    ],
    commands: [
      'run: npm run design:conformance',
      'run: npm run design:export:ios',
    ],
  },
  '.github/workflows/web-ci.yml': {
    label: 'Web',
    paths: [
      'web/**',
      'shared/DESIGN.md',
      'shared/design-tokens/**',
      '.github/workflows/web-ci.yml',
    ],
    commands: [
      'run: npm run design:check',
      'run: npm run design:conformance',
    ],
  },
};

function lineForOffset(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

function addMatches(
  violations: ConformanceViolation[],
  file: string,
  text: string,
  rule: ConformanceRule,
  message: string,
  pattern: RegExp,
): void {
  for (const match of text.matchAll(pattern)) {
    violations.push({
      file,
      line: lineForOffset(text, match.index ?? 0),
      rule,
      message,
    });
  }
}

export function scanInlineCss(file: string, text: string): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  addMatches(
    violations,
    file,
    text,
    'inline-css',
    'Inline <style> elements are prohibited.',
    /<style(?:\s|>)/gi,
  );
  addMatches(
    violations,
    file,
    text,
    'inline-css',
    'Inline style attributes are prohibited.',
    /\sstyle\s*=/gi,
  );
  addMatches(
    violations,
    file,
    text,
    'stylesheet-injection',
    'Inline data stylesheet URLs are prohibited.',
    /data:text\/css(?:[;,])/gi,
  );

  if (/\.(?:[cm]?[jt]s)$/.test(file)) {
    addMatches(
      violations,
      file,
      text,
      'inline-css',
      'JavaScript .style mutations are prohibited.',
      /\.\s*style(?:\.|\[|\s*=)/g,
    );
    addMatches(
      violations,
      file,
      text,
      'stylesheet-injection',
      'Runtime stylesheet injection is prohibited.',
      /createElement\s*\(\s*['"]style['"]\s*\)|insertRule\s*\(|adoptedStyleSheets|new\s+CSSStyleSheet\s*\(/g,
    );
  }

  return violations;
}

export function scanReactSource(file: string, text: string): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  addMatches(
    violations,
    file,
    text,
    'react-source',
    'React and ReactDOM source references are prohibited.',
    /(?:from\s*['"](?:react|react-dom)(?:\/[^'"]*)?['"]|require\s*\(\s*['"](?:react|react-dom)(?:\/[^'"]*)?['"]\s*\)|\bReactDOM\b)/g,
  );
  addMatches(
    violations,
    file,
    text,
    'jsx-runtime',
    'Babel browser/runtime JSX support is prohibited.',
    /@babel\/standalone|babel-standalone|type\s*=\s*['"]text\/babel['"]|\bBabel\.transform\b/g,
  );
  addMatches(
    violations,
    file,
    text,
    'jsx-runtime',
    'Babel runtime source references are prohibited.',
    /(?:from\s*['"]@babel\/runtime(?:\/[^'"]*)?['"]|require\s*\(\s*['"]@babel\/runtime(?:\/[^'"]*)?['"]\s*\))/g,
  );
  return violations;
}

export function scanPackageJson(file: string, text: string): ConformanceViolation[] {
  let parsed: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return [];
  }

  const prohibited = /^(?:react|react-dom|@babel\/standalone|@babel\/runtime)$/;
  const dependencies = {
    ...parsed.dependencies,
    ...parsed.devDependencies,
    ...parsed.peerDependencies,
    ...parsed.optionalDependencies,
  };

  return Object.keys(dependencies)
    .filter((name) => prohibited.test(name))
    .map((name) => ({
      file,
      line: 1,
      rule: 'react-package' as const,
      message: `Prohibited runtime dependency: ${name}.`,
    }));
}

export function scanPackageLock(
  file: string,
  text: string,
): ConformanceViolation[] {
  let parsed: { packages?: Record<string, unknown> };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    return [];
  }

  const prohibited =
    /^node_modules\/(?:react|react-dom|@babel\/standalone|@babel\/runtime)$/;
  return Object.keys(parsed.packages ?? {})
    .filter((packagePath) => prohibited.test(packagePath))
    .map((packagePath) => ({
      file,
      line: 1,
      rule: 'react-package' as const,
      message: `Prohibited installed dependency: ${packagePath.replace(/^node_modules\//, '')}.`,
    }));
}

export function scanCssTokens(file: string, text: string): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const lines = text.split('\n');
  const rawColor = /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i;
  const visualDeclaration =
    /^\s*(font-size|font-weight|font-family|border-radius)\s*:\s*([^;]+);/i;
  const componentSize =
    /^\s*(width|height|min-width|min-height)\s*:\s*(44px|2\.75rem|24px|1\.5rem|20px|1\.25rem)\s*;/i;

  lines.forEach((line, index) => {
    if (rawColor.test(line)) {
      violations.push({
        file,
        line: index + 1,
        rule: 'untokenized-css',
        message: 'Color literals must be defined in variables.css and consumed through var().',
      });
    }

    const visual = line.match(visualDeclaration);
    if (
      visual &&
      visual[2] !== undefined &&
      !/var\(|inherit|initial|unset|revert/.test(visual[2]) &&
      !/^0(?:\s+0){0,3}(?:\s*!important)?$/.test(visual[2].trim())
    ) {
      violations.push({
        file,
        line: index + 1,
        rule: 'untokenized-css',
        message: `${visual[1]} must use a design token.`,
      });
    }

    if (componentSize.test(line)) {
      violations.push({
        file,
        line: index + 1,
        rule: 'untokenized-component-size',
        message: 'Canonical control and icon sizes must use --component-* tokens.',
      });
    }
  });

  return violations;
}

export function scanNativePresentation(
  file: string,
  text: string,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const patterns =
    file.endsWith('.swift')
      ? [
          /RoundedRectangle\s*\(\s*cornerRadius:\s*\d/g,
          /\.cornerRadius\s*\(\s*\d/g,
          /\.font\s*\(\s*\.system\s*\(\s*size:/g,
          /(?:SwiftUI\.)?Color\s*\(\s*(?:red:|white:|hue:)/g,
          /\.(?:frame)\s*\([^)]*\b(?:width|height|minWidth|minHeight|maxWidth|maxHeight):\s*[1-9]\d*(?:\.\d+)?/g,
          /\.padding\s*\(\s*(?:[.[\]a-zA-Z]+\s*,\s*)?[1-9]\d*(?:\.\d+)?\s*\)/g,
          /\bspacing:\s*[1-9]\d*(?:\.\d+)?/g,
          /\.opacity\s*\(\s*(?:0?\.\d+|1\.0)\s*\)/g,
          /\.scaleEffect\s*\(\s*[1-9]\d*(?:\.\d+)?\s*\)/g,
          /\blineWidth:\s*[1-9]\d*(?:\.\d+)?/g,
          /\.shadow\s*\([^)]*\b(?:radius|x|y):\s*[1-9]\d*(?:\.\d+)?/g,
        ]
      : [
          /RoundedCornerShape\s*\(\s*\d/g,
          /\bColor\s*\(\s*0x/g,
          /\.size\s*\(\s*\d+(?:\.\d+)?\.dp/g,
          /\.(?:width|height|padding)\s*\(\s*\d+(?:\.\d+)?\.dp/g,
          /spacedBy\s*\(\s*\d+(?:\.\d+)?\.dp/g,
          /heightIn\s*\(\s*min\s*=\s*\d+(?:\.\d+)?\.dp/g,
          /fontSize\s*=\s*\d+(?:\.\d+)?\.sp/g,
        ];

  for (const pattern of patterns) {
    addMatches(
      violations,
      file,
      text,
      'raw-native-presentation',
      'Native presentation values must use DS tokens or canonical DS components.',
      pattern,
    );
  }
  return violations;
}

export function scanUiEmoji(file: string, text: string): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  addMatches(
    violations,
    file,
    text,
    'ui-emoji',
    'UI emoji are prohibited; use the platform icon library.',
    /\p{Extended_Pictographic}/gu,
  );
  return violations;
}

export function scanDesignSystemWiring(
  file: string,
  text: string,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const addMissing = (message: string): void => {
    violations.push({
      file,
      line: 1,
      rule: 'design-system-wiring',
      message,
    });
  };

  if (file === 'package.json') {
    let parsed: { scripts?: Record<string, string> };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      return violations;
    }
    if (parsed.scripts?.['design:export:ios'] !== IOS_EXPORT_COMMAND) {
      addMissing(
        `The root design:export:ios script must run "${IOS_EXPORT_COMMAND}".`,
      );
    }
  }

  if (file === 'ios/generate-xcode-project.sh') {
    if (
      !text
        .split('\n')
        .some((line) => line.trim() === IOS_PROJECT_EXPORT_COMMAND)
    ) {
      addMissing(
        `The iOS project generator must invoke the root exporter with "${IOS_PROJECT_EXPORT_COMMAND}".`,
      );
    }
  }

  const workflowContract = CI_WORKFLOW_CONTRACTS[file];
  if (workflowContract) {
    const pullRequestStart = text.indexOf('  pull_request:');
    const jobsStart = text.indexOf('\njobs:');
    const pushSection =
      pullRequestStart >= 0 ? text.slice(0, pullRequestStart) : '';
    const pullRequestSection =
      pullRequestStart >= 0 && jobsStart > pullRequestStart
        ? text.slice(pullRequestStart, jobsStart)
        : '';

    for (const designPath of workflowContract.paths) {
      const quotedPath = `'${designPath}'`;
      if (!pushSection.includes(quotedPath)) {
        addMissing(
          `${workflowContract.label} push CI must watch ${designPath}.`,
        );
      }
      if (!pullRequestSection.includes(quotedPath)) {
        addMissing(
          `${workflowContract.label} pull-request CI must watch ${designPath}.`,
        );
      }
    }

    for (const command of workflowContract.commands) {
      if (!text.includes(command)) {
        addMissing(
          `${workflowContract.label} CI must include "${command}".`,
        );
      }
    }
  }

  return violations;
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];

  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (WALK_EXCLUSIONS.has(entry.name)) continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function relative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function isTestFile(file: string): boolean {
  return /(?:^|\/)(?:tests?|e2e|MurphysLawsTests|MurphysLawsUITests)(?:\/|$)|\.(?:test|spec)\./.test(
    file,
  );
}

export function runConformance(root: string): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  const allFiles = walkFiles(root);

  for (const absolute of allFiles) {
    const file = relative(root, absolute);
    if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
      violations.push({
        file,
        line: 1,
        rule: 'jsx-runtime',
        message: 'JSX and TSX files are prohibited.',
      });
    }
    if (path.basename(file) === 'package.json') {
      const text = fs.readFileSync(absolute, 'utf8');
      violations.push(...scanPackageJson(file, text));
      if (file === 'package.json') {
        violations.push(...scanDesignSystemWiring(file, text));
      }
    }
    if (path.basename(file) === 'package-lock.json') {
      violations.push(...scanPackageLock(file, fs.readFileSync(absolute, 'utf8')));
    }
    if (
      file === 'ios/generate-xcode-project.sh' ||
      file in CI_WORKFLOW_CONTRACTS
    ) {
      violations.push(
        ...scanDesignSystemWiring(file, fs.readFileSync(absolute, 'utf8')),
      );
    }
  }

  for (const sourceRoot of INLINE_SOURCE_ROOTS) {
    for (const absolute of walkFiles(path.join(root, sourceRoot))) {
      const file = relative(root, absolute);
      if (isTestFile(file) || !SOURCE_EXTENSIONS.has(path.extname(file))) continue;
      const text = fs.readFileSync(absolute, 'utf8');
      violations.push(...scanInlineCss(file, text));
      violations.push(...scanReactSource(file, text));
    }
  }

  for (const cssRoot of CSS_ROOTS) {
    for (const absolute of walkFiles(path.join(root, cssRoot))) {
      const file = relative(root, absolute);
      if (
        !file.endsWith('.css') ||
        file === CSS_TOKEN_DEFINITION ||
        file === CSS_PRINT_ALLOWLIST
      ) {
        continue;
      }
      violations.push(...scanCssTokens(file, fs.readFileSync(absolute, 'utf8')));
    }
  }

  for (const absolute of walkFiles(path.join(root, 'ios/MurphysLaws'))) {
    const file = relative(root, absolute);
    if (
      !file.endsWith('.swift') ||
      file.endsWith('/Tokens.swift') ||
      file.endsWith('/DesignSystemComponents.swift')
    ) {
      continue;
    }
    violations.push(
      ...scanNativePresentation(file, fs.readFileSync(absolute, 'utf8')),
    );
  }

  for (const absolute of walkFiles(path.join(root, 'android/app/src/main/java'))) {
    const file = relative(root, absolute);
    if (
      !file.endsWith('.kt') ||
      file.endsWith('/Tokens.kt') ||
      file.endsWith('/SocialIcons.kt')
    ) {
      continue;
    }
    violations.push(
      ...scanNativePresentation(file, fs.readFileSync(absolute, 'utf8')),
    );
  }

  const emojiRoots = [
    'web/src',
    'shared/modules',
    'ios/MurphysLaws/Views',
    'ios/MurphysLaws/App',
    'ios/MurphysLaws/ViewModels',
    'android/app/src/main/java/com/murphyslaws/presentation',
  ];
  for (const emojiRoot of emojiRoots) {
    for (const absolute of walkFiles(path.join(root, emojiRoot))) {
      const file = relative(root, absolute);
      if (isTestFile(file)) continue;
      const extension = path.extname(file);
      if (!['.ts', '.html', '.swift', '.kt'].includes(extension)) continue;
      violations.push(...scanUiEmoji(file, fs.readFileSync(absolute, 'utf8')));
    }
  }

  const distRoot = path.join(root, 'web/dist');
  for (const absolute of walkFiles(distRoot)) {
    const file = relative(root, absolute);
    if (!['.html', '.js'].includes(path.extname(file))) continue;
    violations.push(...scanInlineCss(file, fs.readFileSync(absolute, 'utf8')));
    violations.push(
      ...scanReactSource(file, fs.readFileSync(absolute, 'utf8')),
    );
  }

  return violations;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === new URL(`file://${entry}`).href);
}

if (isMain()) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
  );
  const violations = runConformance(repositoryRoot);
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`,
    );
  }
  if (violations.length > 0) {
    console.error(`Design conformance failed with ${violations.length} violation(s).`);
    process.exit(1);
  }
  console.log('Design conformance passed.');
}
