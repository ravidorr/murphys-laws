import { describe, expect, it } from 'vitest';
import { isUsefulDuplicateMatch, normalizeDuplicateText, scoreDuplicateSimilarity } from './duplicate-similarity.ts';

describe('duplicate similarity', () => {
  it('normalizes case, punctuation, and whitespace for exact matches', () => {
    expect(normalizeDuplicateText('  The BACKUP, failed!  ')).toBe('the backup failed');
    expect(scoreDuplicateSimilarity('The backup, failed!', 'the backup failed')).toMatchObject({
      match_type: 'exact', similarity: 1
    });
    expect(scoreDuplicateSimilarity("Don't skip failure-proof checks", 'dont skip failure proof checks')).toMatchObject({
      match_type: 'exact', similarity: 1
    });
  });

  it('requires two significant shared terms and the similarity threshold for fuzzy matches', () => {
    const unrelated = scoreDuplicateSimilarity('The backup failed before deploy', 'The backup you need is forgotten');
    const related = scoreDuplicateSimilarity('The backup failed before deploy', 'The backup failed during deployment');
    expect(isUsefulDuplicateMatch(unrelated)).toBe(false);
    expect(isUsefulDuplicateMatch(related)).toBe(true);
    expect(related.similarity).toBeGreaterThanOrEqual(0.45);
  });
});
