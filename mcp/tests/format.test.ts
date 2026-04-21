import { describe, it, expect } from 'vitest';
import type { Law } from 'murphys-laws-sdk';
import { formatLaw, formatLawList } from '../src/format.js';

type LawData = Law;

describe('formatLaw', () => {
  it('renders full law with score and attributions', () => {
    const law: LawData = {
      id: 1,
      title: 'Title',
      text: 'Anything that can go wrong, will.',
      attributions: [{ name: 'Murphy' }, { name: 'Anonymous' }],
      upvotes: 10,
      downvotes: 2,
      score: 8,
      category_name: 'Life',
    };
    const out = formatLaw(law);
    expect(out).toContain("Murphy's Law #1: Title");
    expect(out).toContain('"Anything that can go wrong, will."');
    expect(out).toContain('Attribution: Murphy');
    expect(out).not.toContain('Anonymous');
    expect(out).toContain('Category: Life');
    expect(out).toContain('Score: +8');
    expect(out).toContain('Source: https://murphys-laws.com/law/1');
  });

  it('uses id-only header when title missing', () => {
    const law: LawData = { id: 3, text: 't' };
    expect(formatLaw(law)).toMatch(/^Murphy's Law #3\n/);
  });

  it('derives score from upvotes/downvotes when missing', () => {
    const law: LawData = { id: 2, text: 't', upvotes: 3, downvotes: 5 };
    expect(formatLaw(law)).toContain('Score: -2 (3 upvotes, 5 downvotes)');
  });

  it('defaults score to 0 when votes missing', () => {
    expect(formatLaw({ id: 4, text: 't' })).toContain('Score: +0 (0 upvotes, 0 downvotes)');
  });

  it('omits attributions when only Anonymous', () => {
    const law: LawData = { id: 5, text: 't', attributions: [{ name: 'Anonymous' }] };
    expect(formatLaw(law)).not.toContain('Attribution:');
  });

  it('parses attributions JSON string', () => {
    const law: LawData = { id: 6, text: 't', attributions: JSON.stringify([{ name: 'Bob' }]) };
    expect(formatLaw(law)).toContain('Attribution: Bob');
  });

  it('handles invalid attributions string gracefully', () => {
    const law: LawData = { id: 7, text: 't', attributions: 'not-json' };
    expect(formatLaw(law)).not.toContain('Attribution:');
  });

  it('handles non-array JSON attributions', () => {
    const law: LawData = { id: 8, text: 't', attributions: '{"not":"array"}' };
    expect(formatLaw(law)).not.toContain('Attribution:');
  });

  it('omits attributions when field is undefined', () => {
    expect(formatLaw({ id: 9, text: 't' })).not.toContain('Attribution:');
  });
});

describe('formatLawList', () => {
  const law: LawData = { id: 1, text: 'hi', upvotes: 1, downvotes: 0 };

  it('returns placeholder when empty', () => {
    expect(formatLawList([])).toBe('No laws found.');
  });

  it('joins laws with separator', () => {
    const out = formatLawList([law, { ...law, id: 2 }]);
    expect(out).toContain("Murphy's Law #1");
    expect(out).toContain("Murphy's Law #2");
    expect(out).toContain('---');
  });

  it('adds "showing" footer when list is truncated', () => {
    expect(formatLawList([law], 10)).toContain('(Showing 1 of 10 results)');
  });

  it('omits footer when list matches total', () => {
    expect(formatLawList([law], 1)).not.toContain('Showing');
  });

  it('omits footer when total is undefined', () => {
    expect(formatLawList([law])).not.toContain('Showing');
  });
});
