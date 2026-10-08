import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CoverageTarget =
  | 'backend'
  | 'web'
  | 'sdk'
  | 'cli'
  | 'mcp'
  | 'ios'
  | 'android';

const orderedTargets: readonly CoverageTarget[] = [
  'backend',
  'web',
  'sdk',
  'cli',
  'mcp',
  'ios',
  'android',
];

function isRootDependencyPath(filePath: string): boolean {
  return [
    'package.json',
    'package-lock.json',
    '.nvmrc',
  ].includes(filePath);
}

export function coverageTargetsFor(paths: readonly string[]): CoverageTarget[] {
  const targets = new Set<CoverageTarget>();

  for (const filePath of paths) {
    if (filePath.startsWith('backend/')) targets.add('backend');
    if (filePath.startsWith('web/')) targets.add('web');
    if (filePath.startsWith('sdk/')) {
      targets.add('sdk');
      targets.add('cli');
      targets.add('mcp');
    }
    if (filePath.startsWith('cli/')) targets.add('cli');
    if (filePath.startsWith('mcp/')) targets.add('mcp');
    if (filePath.startsWith('ios/')) targets.add('ios');
    if (filePath.startsWith('android/')) targets.add('android');
    if (filePath === '.github/workflows/backend-ci.yml') targets.add('backend');
    if (filePath === '.github/workflows/web-ci.yml') targets.add('web');
    if (filePath === '.github/workflows/sdk-ci.yml') targets.add('sdk');
    if (filePath === '.github/workflows/cli-ci.yml') targets.add('cli');
    if (filePath === '.github/workflows/mcp-ci.yml') targets.add('mcp');
    if (filePath === '.github/workflows/ios-ci.yml') targets.add('ios');
    if (filePath === '.github/workflows/android-ci.yml') targets.add('android');

    if (filePath.startsWith('shared/data/') || filePath.startsWith('shared/modules/')) {
      targets.add('backend');
      targets.add('web');
      targets.add('ios');
      targets.add('android');
    }

    if (
      filePath === 'shared/DESIGN.md'
      || filePath.startsWith('shared/design-tokens/')
      || filePath === 'web/DESIGN.md'
      || filePath === 'web/styles/partials/variables.css'
    ) {
      targets.add('web');
      targets.add('ios');
      targets.add('android');
    }

    if (isRootDependencyPath(filePath)) {
      targets.add('backend');
      targets.add('web');
      targets.add('sdk');
      targets.add('cli');
      targets.add('mcp');
      targets.add('ios');
      targets.add('android');
    }
  }

  return orderedTargets.filter((target) => targets.has(target));
}

function commandAvailable(command: string): boolean {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

function run(command: string, args: string[], cwd?: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

function runTarget(target: CoverageTarget, rootDir: string): void {
  if (target === 'ios') {
    if (process.platform !== 'darwin' || !commandAvailable('xcodebuild') || !commandAvailable('xcrun')) {
      console.log('Skipping local iOS coverage because the Xcode toolchain is unavailable. CI will enforce the merge gate.');
      return;
    }
    run('./scripts/test-coverage.sh', [], path.join(rootDir, 'ios'));
    return;
  }

  if (target === 'android') {
    if (!commandAvailable('java') || !existsSync(path.join(rootDir, 'android/gradlew'))) {
      console.log('Skipping local Android coverage because the Android toolchain is unavailable. CI will enforce the merge gate.');
      return;
    }
    run('./gradlew', ['jacocoTestCoverageVerification'], path.join(rootDir, 'android'));
    return;
  }

  if (target === 'cli' || target === 'mcp') {
    run('npm', ['--prefix', 'sdk', 'run', 'build'], rootDir);
    if (process.exitCode !== undefined) return;
  }

  run('npm', ['--prefix', target, 'run', 'test:coverage'], rootDir);
}

function main(): void {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  const targets = coverageTargetsFor(stagedPaths);
  if (targets.length === 0) {
    console.log('No staged files require a coverage check.');
    return;
  }

  for (const target of targets) {
    console.log(`Running ${target} coverage guard...`);
    runTarget(target, rootDir);
    if (process.exitCode !== undefined) return;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
