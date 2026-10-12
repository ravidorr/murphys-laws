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
