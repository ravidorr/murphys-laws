import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findLiveRegistryVersion,
  registryNeedsPublish,
  runRegistryStateCli,
  type RegistryResponse,
} from './mcp-registry-state.ts';

const NAME = 'com.murphys-laws/murphys-laws';
const META = 'io.modelcontextprotocol.registry/official';

function entry(name: string, version: string, isLatest?: boolean) {
  return {
    server: { name, version },
    _meta: isLatest === undefined ? undefined : { [META]: { isLatest } },
  };
}

// Shape of the live registry response: every published version, oldest first.
const multiVersion: RegistryResponse = {
  servers: [entry(NAME, '1.2.1', false), entry(NAME, '1.2.5', true)],
};

test('returns the version the registry flags as latest, not the first match', () => {
  assert.equal(findLiveRegistryVersion(multiVersion, NAME), '1.2.5');
});

test('does not depend on the order of the entries', () => {
  const reversed: RegistryResponse = { servers: [...(multiVersion.servers ?? [])].reverse() };
  assert.equal(findLiveRegistryVersion(reversed, NAME), '1.2.5');
});

test('ignores servers with other names', () => {
  const response: RegistryResponse = {
    servers: [entry('com.example/other', '9.9.9', true), entry(NAME, '1.2.5', true)],
  };
  assert.equal(findLiveRegistryVersion(response, NAME), '1.2.5');
});

test('accepts a single entry that carries no latest flag', () => {
  assert.equal(findLiveRegistryVersion({ servers: [entry(NAME, '1.2.5')] }, NAME), '1.2.5');
});

test('returns an empty version when the server is not in the registry', () => {
  assert.equal(findLiveRegistryVersion({ servers: [] }, NAME), '');
  assert.equal(findLiveRegistryVersion({}, NAME), '');
  assert.equal(findLiveRegistryVersion({ servers: [entry('com.example/other', '1.0.0', true)] }, NAME), '');
});

test('skips entries without a string version', () => {
  const response: RegistryResponse = {
    servers: [{ server: { name: NAME } }, { server: { name: NAME, version: 3 } }, entry(NAME, '1.2.5', true)],
  };
  assert.equal(findLiveRegistryVersion(response, NAME), '1.2.5');
});

test('throws instead of guessing when no latest version can be identified', () => {
  const unflagged: RegistryResponse = { servers: [entry(NAME, '1.2.1', false), entry(NAME, '1.2.5', false)] };
  assert.throws(() => findLiveRegistryVersion(unflagged, NAME), /does not identify one latest version \(1\.2\.1, 1\.2\.5\)/);
});

test('throws when more than one entry is flagged latest', () => {
  const twoLatest: RegistryResponse = { servers: [entry(NAME, '1.2.1', true), entry(NAME, '1.2.5', true)] };
  assert.throws(() => findLiveRegistryVersion(twoLatest, NAME), /does not identify one latest version/);
});

test('publishes only when the live version differs from the expected one', () => {
  assert.equal(registryNeedsPublish('1.2.5', '1.2.5'), false);
  assert.equal(registryNeedsPublish('1.2.1', '1.2.5'), true);
  assert.equal(registryNeedsPublish('', '1.2.5'), true);
});

test('command line output is ready for $GITHUB_OUTPUT', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mcp-registry-state-'));
  try {
    const file = path.join(directory, 'response.json');
    writeFileSync(file, JSON.stringify(multiVersion));

    assert.equal(runRegistryStateCli([file, NAME, '1.2.5']), 'live_version=1.2.5\nneeds_publish=false');
    assert.equal(runRegistryStateCli([file, NAME, '1.2.6']), 'live_version=1.2.5\nneeds_publish=true');
    assert.equal(runRegistryStateCli([file, 'com.example/missing', '1.0.0']), 'live_version=\nneeds_publish=true');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('command line rejects missing arguments', () => {
  assert.throws(() => runRegistryStateCli(['response.json', NAME]), /Usage: mcp-registry-state\.ts/);
});
