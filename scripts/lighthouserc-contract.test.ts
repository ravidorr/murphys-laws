import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const configPath = path.join(rootDirectory, 'lighthouserc.json');
const webCiPath = path.join(rootDirectory, '.github/workflows/web-ci.yml');

test('Lighthouse CI contract', () => {
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    ci: {
      collect: { numberOfRuns: number };
      assert: {
        assertions: Record<
          string,
          ['error', { maxNumericValue: number; aggregationMethod: string }]
        >;
      };
    };
  };

  assert.equal(config.ci.collect.numberOfRuns, 3);

  const lcp = config.ci.assert.assertions['largest-contentful-paint'];
  assert.deepEqual(lcp[1].aggregationMethod, 'median');
  assert.equal(lcp[1].maxNumericValue, 3000);

  const cls = config.ci.assert.assertions['cumulative-layout-shift'];
  assert.deepEqual(cls[1].aggregationMethod, 'median');
  assert.equal(cls[1].maxNumericValue, 0.1);

  const workflow = readFileSync(webCiPath, 'utf8');
  assert.match(workflow, /Warm up preview routes before Lighthouse/);
  assert.match(workflow, /curl -fsS "\$url"/);
});
