import { describe, expect, it } from 'vitest';
import {
  expandDiscoveryQuery,
  inferDiscoveryCategory,
  rankDuplicateCandidates
} from '../src/utils/discovery.ts';

describe('discovery helpers', () => {
  it('expands common user language into archive search terms', () => {
    expect(expandDiscoveryQuery('meetings running late')).toEqual(['meetings running late', 'work', 'office', 'project']);
    expect(expandDiscoveryQuery('software bugs')).toEqual(['software bugs', 'technology', 'computer', 'software']);
  });

  it('infers category slugs from plain-language text', () => {
    expect(inferDiscoveryCategory('deployment failed during software release')).toBe('murphys-technology-laws');
    expect(inferDiscoveryCategory('flight was delayed and luggage disappeared')).toBe('murphys-travel-laws');
  });

  it('ranks duplicate candidates by shared terms without generating text', () => {
    const ranked = rankDuplicateCandidates('backup failed before deploy', [
      { id: 1, text: 'The backup you need is the one you forgot to test' },
      { id: 2, text: 'The line you choose is always slowest' },
    ]);

    expect(ranked[0]!.id).toBe(1);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it('returns null when no category can be inferred', () => {
    expect(inferDiscoveryCategory('plain unclassified words')).toBeNull();
  });

  it('ranks candidates with a missing title from their law text', () => {
    const localThis: { ranked?: ReturnType<typeof rankDuplicateCandidates> } = {};
    localThis.ranked = rankDuplicateCandidates('backup failed before deploy', [
      { id: 1, title: '', text: 'The backup failed before deploy' },
      { id: 2, title: 'Unrelated', text: 'The printer is out of paper' },
    ]);

    expect(localThis.ranked[0]?.id).toBe(1);
    expect(localThis.ranked[0]?.similarity).toBeGreaterThan(localThis.ranked[1]?.similarity ?? 0);
  });

  it('keeps exact matches and uses shared terms to break similarity ties', () => {
    const localThis: { ranked?: ReturnType<typeof rankDuplicateCandidates> } = {};
    localThis.ranked = rankDuplicateCandidates('alpha bravo', [
      { id: 1, title: '', text: 'alpha' },
      { id: 2, title: '', text: 'alpha bravo charlie delta' },
      { id: 3, title: '', text: 'alpha bravo' },
    ]);

    expect(localThis.ranked.map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(localThis.ranked[0]?.match_type).toBe('exact');
  });
});
