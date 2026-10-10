import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findDisallowedVulnerabilities,
  parseExceptions,
} from './check-audit-exceptions.js';

const activeExceptions = [
  {
    id: 'GHSA-ALLOWED-1234',
    expiresOn: '2026-11-09',
    reason: 'Reviewed development-only dependency.',
  },
];

test('allows a high-severity dependency chain covered by an active exception', () => {
  const disallowed = findDisallowedVulnerabilities(
    {
      vulnerabilities: {
        direct: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-allowed-1234' }],
        },
        wrapper: {
          severity: 'high',
          via: ['direct'],
        },
      },
    },
    activeExceptions,
    '2026-10-10',
  );

  assert.deepEqual(disallowed, []);
});

test('rejects unreviewed high-severity advisories', () => {
  const disallowed = findDisallowedVulnerabilities(
    {
      vulnerabilities: {
        direct: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-UNKNOWN-5678' }],
        },
      },
    },
    activeExceptions,
    '2026-10-10',
  );

  assert.deepEqual(disallowed, [
    {
      advisories: ['GHSA-UNKNOWN-5678'],
      packageName: 'direct',
    },
  ]);
});

test('rejects expired exceptions and unidentified high-severity advisories', () => {
  const disallowed = findDisallowedVulnerabilities(
    {
      vulnerabilities: {
        expired: {
          severity: 'high',
          via: [{ url: 'https://github.com/advisories/GHSA-allowed-1234' }],
        },
        unidentified: {
          severity: 'critical',
          via: [],
        },
      },
    },
    activeExceptions,
    '2026-11-10',
  );

  assert.deepEqual(disallowed, [
    {
      advisories: ['GHSA-ALLOWED-1234'],
      packageName: 'expired',
    },
    {
      advisories: [],
      packageName: 'unidentified',
    },
  ]);
});

test('defaults missing exceptions to an empty allowlist', () => {
  assert.deepEqual(parseExceptions('{}'), []);
});
