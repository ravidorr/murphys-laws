import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(
  path.join(rootDirectory, '.github/workflows/mcp-registry-publish.yml'),
  'utf8',
);

test('MCP release workflow publishes npm before registry metadata', () => {
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /mcp\/package\.json/);
  assert.doesNotMatch(workflow, /- '\.github\/workflows\/mcp-registry-publish\.yml'/);
  assert.match(workflow, /npm publish --workspace=murphys-laws-mcp --provenance --access public/);
  assert.match(workflow, /Wait for npm package availability/);
  assert.match(workflow, /Publish to MCP Registry/);

  assert.ok(
    workflow.indexOf('Publish npm package') < workflow.indexOf('Publish to MCP Registry'),
    'npm must publish before the MCP Registry',
  );
});

test('MCP release workflow is idempotent and waits for npm visibility', () => {
  assert.match(workflow, /id: npm/);
  assert.match(workflow, /needs_publish=false/);
  assert.match(workflow, /needs_publish=true/);
  assert.match(workflow, /seq 1 20/);
  assert.match(workflow, /sleep 15/);
  assert.match(workflow, /did not become publicly available/);
  assert.match(workflow, /Registry already has/);
  assert.match(workflow, /Verify entry is live at expected version/);
});

test('MCP release workflow uses a trusted-publishing-capable npm version', () => {
  assert.match(workflow, /npm install --global npm@11\.5\.1/);
  assert.ok(
    workflow.indexOf('Install npm for trusted publishing') < workflow.indexOf('Publish npm package'),
    'npm must be upgraded before publishing',
  );
});

test('MCP release workflow does not coalesce pending release versions', () => {
  assert.doesNotMatch(workflow, /^concurrency:/m);
});

test('MCP release workflow retries bounded registry reads', () => {
  assert.equal((workflow.match(/--retry 5/g) ?? []).length, 2);
  assert.equal((workflow.match(/--retry-all-errors/g) ?? []).length, 2);
  assert.equal((workflow.match(/--retry-max-time 120/g) ?? []).length, 2);
  assert.equal((workflow.match(/--connect-timeout 15/g) ?? []).length, 2);
  assert.equal((workflow.match(/--max-time 30/g) ?? []).length, 2);
});

test('MCP release workflow buffers registry reads before parsing retried responses', () => {
  assert.equal(
    (
      workflow.match(
        /--output "\$RESPONSE_FILE"[\s\S]*?mcp-registry-state\.ts "\$RESPONSE_FILE" "\$EXPECTED_NAME" "\$EXPECTED_VERSION"/g,
      ) ?? []
    ).length,
    2,
  );
});

test('MCP release workflow reads registry state through the tested helper, not inline jq', () => {
  assert.doesNotMatch(workflow, /select\(\.server\.name == \$name\)/);
  assert.match(workflow, /node --experimental-strip-types scripts\/mcp-registry-state\.ts/);
});

test('MCP release workflow only triggers on paths that change the published package', () => {
  assert.doesNotMatch(workflow, /- 'mcp\/\*\*'/);
  for (const trigger of ['mcp/src/**', 'mcp/bin/**', 'mcp/package.json', 'mcp/server.json']) {
    assert.ok(workflow.includes(`- '${trigger}'`), `${trigger} must trigger a release`);
  }
  assert.doesNotMatch(workflow, /- 'mcp\/tests/);
});

test('MCP release workflow checks state before installing and exits early when released', () => {
  const planned = workflow.indexOf('id: plan');
  assert.ok(workflow.indexOf('id: npm') < planned, 'npm state is checked before the plan');
  assert.ok(workflow.indexOf('id: registry') < planned, 'registry state is checked before the plan');
  assert.match(workflow, /release_needed=false/);

  for (const step of [
    'Install npm for trusted publishing',
    'Install dependencies',
    'Validate MCP release version contract',
    'Build SDK',
    'Validate MCP package',
    'Publish npm package',
    'Wait for npm package availability',
    'Install mcp-publisher',
    'Publish to MCP Registry',
    'Verify entry is live at expected version',
  ]) {
    const start = workflow.indexOf(`- name: ${step}`);
    assert.ok(start > planned, `${step} must come after the plan step`);
    const stepEnd = workflow.indexOf('\n      - name:', start + 1);
    const body = workflow.slice(start, stepEnd === -1 ? undefined : stepEnd);
    assert.match(body, /if: steps\.plan\.outputs\.release_needed == 'true'/, `${step} must be gated`);
  }
});
test('MCP release workflow reads only the latest registry version', () => {
  // The search endpoint lists every published version; without version=latest the first
  // match can be an older release (1.2.1) and the workflow re-publishes an existing version.
  assert.equal(
    (workflow.match(/v0\/servers\?search=\$\{EXPECTED_NAME\}&version=latest/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(workflow, /v0\/servers\?search=\$\{EXPECTED_NAME\}"/);
});
