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

type JsonObject = Record<string, unknown>;

type LockfileEntry = { label: string; version: unknown };

type LockfileCheck = {
  packageJson: string;
  lockfile: string;
  entries: (lock: JsonObject) => LockfileEntry[];
};

function versionAt(lock: JsonObject, key: string): unknown {
  const packages = lock.packages;
  if (typeof packages !== 'object' || packages === null) {
    return undefined;
  }

  const entry = (packages as Record<string, unknown>)[key];
  return typeof entry === 'object' && entry !== null ? (entry as JsonObject).version : undefined;
}

/** The two places an npm lockfile records the version of the package it belongs to. */
function ownEntries(lock: JsonObject): LockfileEntry[] {
  return [
    { label: 'version', version: lock.version },
    { label: 'packages[""].version', version: versionAt(lock, '') },
  ];
}

/** The place the root lockfile records the version of one of its workspaces. */
function workspaceEntries(workspace: string): (lock: JsonObject) => LockfileEntry[] {
  return (lock) => [{ label: `packages["${workspace}"].version`, version: versionAt(lock, workspace) }];
}

/** Keep the workspace rows in step with the `workspaces` array of the root package.json. */
export const lockfileChecks: LockfileCheck[] = [
  { packageJson: 'package.json', lockfile: 'package-lock.json', entries: ownEntries },
  { packageJson: 'backend/package.json', lockfile: 'backend/package-lock.json', entries: ownEntries },
  ...['backend', 'web', 'mcp', 'sdk', 'cli'].map((workspace) => ({
    packageJson: `${workspace}/package.json`,
    lockfile: 'package-lock.json',
    entries: workspaceEntries(workspace),
  })),
];

function parseJsonObject(content: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as JsonObject) : null;
  } catch {
    return null;
  }
}

/**
 * Everything wrong with how package.json versions and lockfiles line up, read from the index.
 *
 * A package.json version must equal every place a lockfile records it, otherwise the next
 * `npm install` rewrites the lockfile and leaves a dirty worktree. This is a commit gate, so it fails
 * closed: a file that is missing from the index, is not a JSON object (a merge conflict left in a
 * lockfile, say), or lacks the lockfile entry it should have is a problem, not something to skip. The
 * only silent skip is a package.json that parses but has no version, which a private package may omit.
 */
export function findLockfileProblems(readAfter: (filePath: string) => string | null): string[] {
  const problems = new Set<string>();

  for (const { packageJson, lockfile, entries } of lockfileChecks) {
    const packageText = readAfter(packageJson);
    const lockText = readAfter(lockfile);

    if (packageText === null) {
      problems.add(`${packageJson} is missing from the index`);
    }
    if (lockText === null) {
      problems.add(`${lockfile} is missing from the index`);
    }
    if (packageText === null || lockText === null) {
      continue;
    }

    const pkg = parseJsonObject(packageText);
    const lock = parseJsonObject(lockText);

    if (pkg === null) {
      problems.add(`${packageJson} is not a valid JSON object`);
    }
    if (lock === null) {
      problems.add(`${lockfile} is not a valid JSON object`);
    }
    if (pkg === null || lock === null || typeof pkg.version !== 'string') {
      continue;
    }

    for (const { label, version } of entries(lock)) {
      if (typeof version !== 'string') {
        problems.add(`${packageJson} is ${pkg.version} but ${lockfile} has no ${label}`);
      } else if (version !== pkg.version) {
        problems.add(`${packageJson} is ${pkg.version} but ${lockfile} ${label} is ${version}`);
      }
    }
  }

  return [...problems];
}

function git(args: string[]): string {
  // Lockfiles can pass the 1 MiB default, and a truncated read must not look like a missing file.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function readFromHead(filePath: string): string | null {
  try {
    git(['rev-parse', '--verify', '--quiet', 'HEAD']);
  } catch {
    return null; // no commits yet
  }

  return git(['ls-tree', 'HEAD', '--', filePath]).trim() === '' ? null : git(['show', `HEAD:${filePath}`]);
}

function readFromIndex(filePath: string): string | null {
  return git(['ls-files', '--stage', '--', filePath]).trim() === '' ? null : git(['show', `:${filePath}`]);
}

/** `--lockfiles` checks only that package.json versions match the lockfiles, skipping the version-bump rules. */
function main(args: string[]): void {
  const lockfilesOnly = args.includes('--lockfiles');
  const stagedFiles = lockfilesOnly
    ? []
    : parseStagedFiles(git(['diff', '--cached', '--name-status', '--diff-filter=ACMRTD']));
  const missing = lockfilesOnly ? [] : findMissingVersionBumps(stagedFiles, readFromHead, readFromIndex);
  const lockfileProblems = findLockfileProblems(readFromIndex);

  if (missing.length === 0 && lockfileProblems.length === 0) {
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

  if (lockfileProblems.length > 0) {
    console.error('');
    console.error('ERROR: package.json versions and lockfiles are out of sync.');
    console.error('');
    for (const item of lockfileProblems) {
      console.error(`- ${item}`);
    }
    console.error('');
    console.error('Regenerate the lockfile that is out of date, stage it, and retry the commit:');
    console.error('  package-lock.json          npm install --package-lock-only          (run at the repository root)');
    console.error('  backend/package-lock.json  (cd backend && npm install --package-lock-only --no-workspaces)');
    console.error('A file that is missing or not valid JSON has to be restored first.');
  }

  process.exit(1);
}

if (process.argv[1]?.endsWith('check-version-bumps.ts')) {
  main(process.argv.slice(2));
}
