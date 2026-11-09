import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const workflowsDirectory = path.join(rootDirectory, '.github/workflows');

test('the npm ci action retries three times and passes its arguments through the environment', () => {
  const action = readFileSync(path.join(rootDirectory, '.github/actions/npm-ci/action.yml'), 'utf8');

  assert.match(action, /using: composite/);
  assert.match(action, /for attempt in 1 2 3; do/);
  assert.match(action, /NPM_CI_ARGS: \$\{\{ inputs\.args \}\}/);
  assert.match(action, /npm ci \$NPM_CI_ARGS/);
  // The last failed attempt must not wait before giving up.
  assert.match(action, /if \[ "\$attempt" -lt 3 \]; then\n\s+sleep/);
  assert.match(action, /exit 1/);
});

test('no workflow runs a bare npm ci step that downloads native binaries without the retries', () => {
  // `npm ci --ignore-scripts` (lockfile-sync) runs no install scripts, so it downloads no binary.
  const bareInstall = /^\s*(?:- )?run: npm ci\s*$/m;

  for (const workflowName of readdirSync(workflowsDirectory).filter((name) => name.endsWith('.yml'))) {
    const workflow = readFileSync(path.join(workflowsDirectory, workflowName), 'utf8');
    assert.doesNotMatch(workflow, bareInstall, `${workflowName} runs a bare "npm ci"; use ./.github/actions/npm-ci`);
  }
});

test('the Android builds fetch the Gradle distribution in a retried step first', () => {
  for (const workflowName of ['android-ci.yml', 'codeql.yml']) {
    const workflow = readFileSync(path.join(workflowsDirectory, workflowName), 'utf8');
    const download = workflow.indexOf('Download the Gradle distribution (retried)');
    const build = workflow.search(/\.\/gradlew (clean )?assembleDebug/);

    assert.ok(download !== -1 && build !== -1 && download < build, `${workflowName}: Gradle download step must precede the build`);
    assert.match(workflow, /\.\/gradlew --version --no-daemon/);
  }
});
