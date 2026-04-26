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
  return !ignoredRootFiles.has(filePath) && !versionFilePaths.has(filePath);
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

  if (missing.length === 0) {
    return;
  }

  console.error('');
  console.error('ERROR: Staged changes require version bumps.');
  console.error('');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  console.error('');
  console.error('Update the listed version files, stage them, and retry the commit.');
  process.exit(1);
}

if (process.argv[1]?.endsWith('check-version-bumps.ts')) {
  main();
}
