import { describe, it, expect } from 'vitest';
import type { Law, Category } from 'murphys-laws-sdk';
import { selectColors } from '../src/colors.js';
import { formatLaw, formatLawList, formatCategories } from '../src/format.js';

const PLAIN = selectColors({ colorFlag: false, isTTY: false, env: {} });

describe('formatLaw', () => {
  it('renders full law with score and attributions', () => {
    const law: Law = {
      id: 1,
      title: 'Title',
      text: 'Anything that can go wrong will go wrong.',
      attributions: [{ name: 'Murphy' }, { name: 'Anonymous' }],
      upvotes: 10,
      downvotes: 2,
      score: 8,
      category_name: 'Life',
    };
    const out = formatLaw(law, PLAIN);
    expect(out).toContain("Murphy's Law");
    expect(out).toContain('#1');
    expect(out).toContain('Title');
    expect(out).toContain('Attribution: Murphy');
    expect(out).toContain('Category: Life');
    expect(out).toContain('Score: +8');
    expect(out).toContain('Source: https://murphys-laws.com/law/1');
  });

  it('derives score from upvotes/downvotes when missing', () => {
    const law: Law = { id: 2, text: 't', upvotes: 3, downvotes: 5 };
    expect(formatLaw(law, PLAIN)).toContain('Score: -2 (3 up, 5 down)');
  });

  it('defaults score to 0 when votes missing', () => {
    const law: Law = { id: 3, text: 't' };
    expect(formatLaw(law, PLAIN)).toContain('Score: +0');
  });

  it('omits attributions when only anonymous', () => {
    const law: Law = { id: 4, text: 't', attributions: [{ name: 'Anonymous' }] };
    expect(formatLaw(law, PLAIN)).not.toContain('Attribution:');
  });

  it('parses attributions JSON string', () => {
    const law: Law = { id: 5, text: 't', attributions: JSON.stringify([{ name: 'Bob' }]) };
    expect(formatLaw(law, PLAIN)).toContain('Attribution: Bob');
  });

  it('handles invalid attributions string gracefully', () => {
    const law: Law = { id: 6, text: 't', attributions: 'not-json' };
    const out = formatLaw(law, PLAIN);
    expect(out).toContain('#6');
    expect(out).not.toContain('Attribution:');
  });

  it('handles non-array JSON attributions', () => {
    const law: Law = { id: 7, text: 't', attributions: '{"not":"array"}' };
    const out = formatLaw(law, PLAIN);
    expect(out).not.toContain('Attribution:');
  });
});

describe('formatLawList', () => {
  const law: Law = { id: 1, text: 'hello', upvotes: 1, downvotes: 0 };

  it('returns placeholder when empty', () => {
    expect(formatLawList([], 0, PLAIN)).toBe('No laws found.');
  });

  it('renders multiple laws with separator', () => {
    const out = formatLawList([law, { ...law, id: 2 }], 2, PLAIN);
    expect(out).toContain('#1');
    expect(out).toContain('#2');
    expect(out).toContain('---');
  });

  it('adds showing line when truncated', () => {
    const out = formatLawList([law], 10, PLAIN);
    expect(out).toContain('(Showing 1 of 10 results)');
  });
});

describe('formatCategories', () => {
  const cats: Category[] = [
    { id: 1, slug: 'a', title: 'Alpha', description: null, law_count: 2 },
    { id: 2, slug: 'b', title: 'Beta', description: 'desc', law_count: 5 },
  ];

  it('returns placeholder when empty', () => {
    expect(formatCategories([], PLAIN)).toBe('No categories available.');
  });

  it('renders title, slug, count and description', () => {
    const out = formatCategories(cats, PLAIN);
    expect(out).toContain('Alpha');
    expect(out).toContain('slug: a');
    expect(out).toContain('2 laws');
    expect(out).toContain('Beta');
    expect(out).toContain('- desc');
  });
});
