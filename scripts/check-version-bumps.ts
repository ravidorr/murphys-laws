import { execFileSync } from 'node:child_process';

type VersionFile = {
  path: string;
  label: string;
  hasVersionBump: (before: string | null, after: string | null) => boolean;
};

type VersionRule = {
  name: string;
  trigger: (filePath: string) => boolean;
  versionFiles: VersionFile[];
};

type StagedFile = {
  path: string;
  status: string;
};

const ignoredRootFiles = new Set([
  'CHANGELOG.md',
  'package-lock.json',
  'package.json',
]);

const versionFilePaths = new Set([
  'backend/package.json',
  'cli/package.json',
  'mcp/package.json',
  'sdk/package.json',
  'web/package.json',
  'ios/project.yml',
  'ios/MurphysLaws/Info.plist',
  'ios/MurphysLaws.xcodeproj/project.pbxproj',
  'android/app/build.gradle.kts',
]);

const documentationExtensions = new Set(['.md', '.markdown', '.txt']);

function isDocumentationOnly(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return [...documentationExtensions].some((extension) => lowerPath.endsWith(extension));
}

function isRootReleaseBearing(filePath: string): boolean {
  return !ignoredRootFiles.has(filePath) &&
    !versionFilePaths.has(filePath) &&
    !isDocumentationOnly(filePath);
}

function isPackageReleaseBearing(prefix: string, filePath: string): boolean {
  return filePath.startsWith(prefix) && !versionFilePaths.has(filePath) && !isDocumentationOnly(filePath);
}

function isPlatformReleaseBearing(prefix: string, filePath: string): boolean {
  return filePath.startsWith(prefix) && !versionFilePaths.has(filePath) && !isDocumentationOnly(filePath);
}

function parseJsonVersion(content: string | null): string | null {
  if (content === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

type McpServerManifest = {
  version?: unknown;
  packages?: Array<{
    version?: unknown;
  }>;
};

export function isMcpManifestSynchronizationRepair(
  changedPaths: string[],
  readBefore: (filePath: string) => string | null,
  readAfter: (filePath: string) => string | null,
): boolean {
  const mcpChanges = changedPaths.filter(
    (filePath) => filePath.startsWith('mcp/') && !isDocumentationOnly(filePath),
  );

  if (mcpChanges.length !== 1 || mcpChanges[0] !== 'mcp/server.json') {
    return false;
  }

  const packageVersion = parseJsonVersion(readAfter('mcp/package.json'));
  const previousPackageVersion = parseJsonVersion(readBefore('mcp/package.json'));
  let serverBefore: McpServerManifest;
  let serverAfter: McpServerManifest;

  try {
    serverBefore = JSON.parse(readBefore('mcp/server.json') ?? '{}') as McpServerManifest;
    serverAfter = JSON.parse(readAfter('mcp/server.json') ?? '{}') as McpServerManifest;
  } catch {
    return false;
  }

  return Boolean(
    packageVersion &&
    previousPackageVersion === packageVersion &&
    serverBefore.version !== packageVersion &&
    serverBefore.packages?.[0]?.version !== packageVersion &&
    serverAfter.version === packageVersion &&
    serverAfter.packages?.[0]?.version === packageVersion,
  );
}

function parseRegexValue(content: string | null, regex: RegExp): string | null {
  if (content === null) {
    return null;
  }

  return regex.exec(content)?.[1] ?? null;
}

function hasJsonVersionBump(before: string | null, after: string | null): boolean {
  const beforeVersion = parseJsonVersion(before);
  const afterVersion = parseJsonVersion(after);

  return beforeVersion !== null && afterVersion !== null && beforeVersion !== afterVersion;
}

function hasIosProjectVersionBump(before: string | null, after: string | null): boolean {
  const beforeMarketing = parseRegexValue(before, /MARKETING_VERSION:\s*["']?([^"'\n]+)["']?/);
  const afterMarketing = parseRegexValue(after, /MARKETING_VERSION:\s*["']?([^"'\n]+)["']?/);
  const beforeBuild = parseRegexValue(before, /CURRENT_PROJECT_VERSION:\s*["']?([^"'\n]+)["']?/);
  const afterBuild = parseRegexValue(after, /CURRENT_PROJECT_VERSION:\s*["']?([^"'\n]+)["']?/);

  return Boolean(
    beforeMarketing && afterMarketing && beforeMarketing !== afterMarketing &&
      beforeBuild && afterBuild && beforeBuild !== afterBuild,
  );
}

function hasIosInfoPlistVersionBump(before: string | null, after: string | null): boolean {
  const beforeMarketing = parseRegexValue(
    before,
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
  );
  const afterMarketing = parseRegexValue(
    after,
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
  );
  const beforeBuild = parseRegexValue(before, /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/);
  const afterBuild = parseRegexValue(after, /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/);

  return Boolean(
    beforeMarketing && afterMarketing && beforeMarketing !== afterMarketing &&
      beforeBuild && afterBuild && beforeBuild !== afterBuild,
  );
}

function hasAndroidVersionBump(before: string | null, after: string | null): boolean {
  const beforeName = parseRegexValue(before, /versionName\s*=\s*"([^"]+)"/);
  const afterName = parseRegexValue(after, /versionName\s*=\s*"([^"]+)"/);
  const beforeCode = parseRegexValue(before, /versionCode\s*=\s*(\d+)/);
  const afterCode = parseRegexValue(after, /versionCode\s*=\s*(\d+)/);

  return Boolean(beforeName && afterName && beforeName !== afterName && beforeCode && afterCode && beforeCode !== afterCode);
}

export const versionRules: VersionRule[] = [
  {
    name: 'root package',
    trigger: isRootReleaseBearing,
    versionFiles: [
      { path: 'package.json', label: 'root package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'web package',
    trigger: (filePath) => isPackageReleaseBearing('web/', filePath) || filePath.startsWith('shared/content/'),
    versionFiles: [
      { path: 'web/package.json', label: 'web/package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'backend package',
    trigger: (filePath) => isPackageReleaseBearing('backend/', filePath),
    versionFiles: [
      { path: 'backend/package.json', label: 'backend/package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'cli package',
    trigger: (filePath) => isPackageReleaseBearing('cli/', filePath),
    versionFiles: [
      { path: 'cli/package.json', label: 'cli/package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'mcp package',
    trigger: (filePath) => isPackageReleaseBearing('mcp/', filePath),
    versionFiles: [
      { path: 'mcp/package.json', label: 'mcp/package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'sdk package',
    trigger: (filePath) => isPackageReleaseBearing('sdk/', filePath),
    versionFiles: [
      { path: 'sdk/package.json', label: 'sdk/package.json version', hasVersionBump: hasJsonVersionBump },
    ],
  },
  {
    name: 'iOS app',
    trigger: (filePath) => isPlatformReleaseBearing('ios/', filePath) || filePath.startsWith('shared/content/'),
    versionFiles: [
      { path: 'ios/project.yml', label: 'ios/project.yml marketing and build versions', hasVersionBump: hasIosProjectVersionBump },
      {
        path: 'ios/MurphysLaws/Info.plist',
        label: 'ios/MurphysLaws/Info.plist marketing and build versions',
        hasVersionBump: hasIosInfoPlistVersionBump,
      },
    ],
  },
  {
    name: 'Android app',
    trigger: (filePath) => isPlatformReleaseBearing('android/', filePath) || filePath.startsWith('shared/content/'),
    versionFiles: [
      {
        path: 'android/app/build.gradle.kts',
        label: 'android/app/build.gradle.kts versionName and versionCode',
        hasVersionBump: hasAndroidVersionBump,
      },
    ],
  },
];

const iosProjectYmlPath = 'ios/project.yml';
const iosInfoPlistPath = 'ios/MurphysLaws/Info.plist';
const iosPbxprojPath = 'ios/MurphysLaws.xcodeproj/project.pbxproj';

type IosVersionSource = {
  path: string;
  marketing: string[];
  build: string[];
};

type IosVersionPattern = {
  /** Matches a line that carries a value, capturing the value. */
  value: RegExp;
  /** Matches every line that mentions the key at all, whether or not its value can be read. */
  mention: RegExp;
};

type IosFileSpec = {
  path: string;
  marketing: IosVersionPattern;
  build: IosVersionPattern;
  /** How many times each key must appear. */
  minimumOccurrences: number;
};

const iosFileSpecs: IosFileSpec[] = [
  {
    path: iosProjectYmlPath,
    marketing: {
      value: /^\s*MARKETING_VERSION:\s*("[^"]*"|'[^']*'|[^\s#]+)\s*(?:#.*)?$/gm,
      mention: /^\s*MARKETING_VERSION:/gm,
    },
    build: {
      value: /^\s*CURRENT_PROJECT_VERSION:\s*("[^"]*"|'[^']*'|[^\s#]+)\s*(?:#.*)?$/gm,
      mention: /^\s*CURRENT_PROJECT_VERSION:/gm,
    },
    minimumOccurrences: 1,
  },
  {
    path: iosInfoPlistPath,
    marketing: {
      value: /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/g,
      mention: /<key>CFBundleShortVersionString<\/key>/g,
    },
    build: {
      value: /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/g,
      mention: /<key>CFBundleVersion<\/key>/g,
    },
    minimumOccurrences: 1,
  },
  {
    // The project-level Debug and Release configurations each carry the version; the targets inherit it.
    path: iosPbxprojPath,
    marketing: {
      value: /^\s*MARKETING_VERSION = ([^;]+);\s*$/gm,
      mention: /^\s*MARKETING_VERSION\s*=/gm,
    },
    build: {
      value: /^\s*CURRENT_PROJECT_VERSION = ([^;]+);\s*$/gm,
      mention: /^\s*CURRENT_PROJECT_VERSION\s*=/gm,
    },
    minimumOccurrences: 2,
  },
];

function unquote(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, '$2');
}

function readIosVersionSource(spec: IosFileSpec, content: string | null): IosVersionSource | string[] {
  if (content === null) {
    return [`iOS versions: ${spec.path} cannot be read`];
  }

  const problems: string[] = [];
  const values: Record<'marketing' | 'build', string[]> = { marketing: [], build: [] };

  for (const [key, label] of [['marketing', 'marketing version'], ['build', 'build number']] as const) {
    const pattern = spec[key];
    values[key] = [...content.matchAll(pattern.value)].map((match) => unquote(match[1]));
    const mentions = [...content.matchAll(pattern.mention)].length;

    if (values[key].length === 0) {
      problems.push(`iOS versions: ${spec.path} has no ${label} that can be read`);
    } else if (values[key].length < mentions) {
      problems.push(`iOS versions: ${spec.path} has a ${label} line that cannot be read`);
    } else if (values[key].length < spec.minimumOccurrences) {
      problems.push(
        `iOS versions: ${spec.path} has the ${label} ${values[key].length} time(s), expected at least ${spec.minimumOccurrences}`,
      );
    }
  }

  return problems.length > 0 ? problems : { path: spec.path, ...values };
}

/**
 * The iOS app version is written in three places that must agree: `ios/project.yml` (the XcodeGen input, which the
 * iOS CI builds from because it regenerates the project), the app's `Info.plist` and the committed
 * `project.pbxproj` (which a local Xcode build uses; its project-level Debug and Release configurations both carry
 * the version and the targets inherit it). Returns one message per disagreement, and the problems of any file that is
 * missing, has no version in it, has a version line that cannot be read or has fewer occurrences than expected, so a
 * file that cannot be checked fails the check instead of being skipped.
 */
export function findIosVersionDrift(readFile: (filePath: string) => string | null): string[] {
  const results = iosFileSpecs.map((spec) => readIosVersionSource(spec, readFile(spec.path)));
  const problems = results.flatMap((result) => (Array.isArray(result) ? result : []));
  const readable = results.filter((result): result is IosVersionSource => !Array.isArray(result));

  if (problems.length > 0) {
    return problems;
  }

  const describe = (key: 'marketing' | 'build') =>
    readable.map((source) => `${source.path} has ${[...new Set(source[key])].join(', ')}`).join('; ');
  const drift: string[] = [];

  for (const [key, label] of [['marketing', 'marketing version'], ['build', 'build number']] as const) {
    const values = new Set(readable.flatMap((source) => source[key]));
    if (values.size > 1) {
      drift.push(`iOS versions: the ${label} differs between files (${describe(key)})`);
    }
  }

  return drift;
}

export function parseStagedFiles(output: string): StagedFile[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split(/\s+/);
      return { status, path: pathParts[pathParts.length - 1] };
    });
}

export function findMissingVersionBumps(
  stagedFiles: StagedFile[],
  readBefore: (filePath: string) => string | null,
  readAfter: (filePath: string) => string | null,
): string[] {
  const changedPaths = stagedFiles.map((file) => file.path);
  const impactedRules = versionRules.filter((rule) => changedPaths.some(rule.trigger));
  const missing: string[] = [];

  for (const rule of impactedRules) {
    for (const versionFile of rule.versionFiles) {
      if (!versionFile.hasVersionBump(readBefore(versionFile.path), readAfter(versionFile.path))) {
        missing.push(`${rule.name}: ${versionFile.label}`);
      }
    }
  }

  if (isMcpManifestSynchronizationRepair(changedPaths, readBefore, readAfter)) {
    return missing.filter((item) => item !== 'mcp package: mcp/package.json version');
  }

  return missing;
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function readFromHead(filePath: string): string | null {
  try {
    return git(['show', `HEAD:${filePath}`]);
  } catch {
    return null;
  }
}

function readFromIndex(filePath: string): string | null {
  try {
    return git(['show', `:${filePath}`]);
  } catch {
    return null;
  }
}

function main(): void {
  const stagedFiles = parseStagedFiles(git(['diff', '--cached', '--name-status', '--diff-filter=ACMRTD']));
  const missing = findMissingVersionBumps(stagedFiles, readFromHead, readFromIndex);
  const drift = findIosVersionDrift(readFromIndex);

  if (missing.length === 0 && drift.length === 0) {
    return;
  }

  if (missing.length > 0) {
    console.error('');
    console.error('ERROR: Staged changes require version bumps.');
    console.error('');
    for (const item of missing) {
      console.error(`- ${item}`);
    }
    console.error('');
    console.error('Update the listed version files, stage them, and retry the commit.');
  }

  if (drift.length > 0) {
    console.error('');
    console.error('ERROR: The iOS app version is not the same in every file that records it.');
    console.error('');
    for (const item of drift) {
      console.error(`- ${item}`);
    }
    console.error('');
    console.error(
      `Set MARKETING_VERSION and CURRENT_PROJECT_VERSION in ${iosProjectYmlPath} and ${iosPbxprojPath} (every configuration), ` +
        `and CFBundleShortVersionString and CFBundleVersion in ${iosInfoPlistPath}, to the same values.`,
    );
  }

  process.exit(1);
}

if (process.argv[1]?.endsWith('check-version-bumps.ts')) {
  main();
}
