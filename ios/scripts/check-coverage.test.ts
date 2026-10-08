import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTargetLineCoverage,
  meetsCoverageThreshold,
} from './check-coverage.js';

test('returns the application target line coverage', () => {
  assert.equal(
    getTargetLineCoverage({
      targets: [{ name: 'MurphysLaws.app', lineCoverage: 0.6828 }],
    }, 'MurphysLaws.app'),
    0.6828,
  );
});

test('accepts the exact 65 percent threshold', () => {
  assert.equal(meetsCoverageThreshold(0.65, 0.65), true);
  assert.equal(meetsCoverageThreshold(0.6499, 0.65), false);
});

test('rejects a report without the application target', () => {
  assert.throws(
    () => getTargetLineCoverage({ targets: [] }, 'MurphysLaws.app'),
    /MurphysLaws\.app/,
  );
});
