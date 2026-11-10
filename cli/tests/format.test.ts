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

  it('lists the corollaries of a law with their ids and titles', () => {
    const out = formatLaw(
      {
        id: 5,
        text: 'Parent.',
        corollaries: [
          { id: 11, title: 'The Ignition Corollary', text: 'Restart feels slow.', upvotes: 3, downvotes: 1 },
          { id: 12, title: 'Corollary', text: 'The light stays green.', upvotes: 0, downvotes: 0 },
          { id: 13, title: null, text: 'No title at all.', upvotes: 1, downvotes: 0 },
        { id: 14, title: 'Disliked', text: 'Nobody likes this one.', upvotes: 0, downvotes: 2 },
        ],
      },
      PLAIN,
    );
    expect(out).toContain('Corollaries (4):');
    expect(out).toContain('- #11 The Ignition Corollary: Restart feels slow. (+2)');
    expect(out).toContain('- #12: The light stays green. (+0)');
    expect(out).toContain('- #13: No title at all. (+1)');
    expect(out).toContain('- #14 Disliked: Nobody likes this one. (-2)');
    expect(out.indexOf('Corollaries (4):')).toBeLessThan(out.indexOf('Source:'));
  });

  it('names the parent of a corollary', () => {
    const out = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 5, title: 'Start-Stop', text: 'Parent text.' } }, PLAIN);
    expect(out).toContain('Corollary of: #5 Start-Stop');
  });

  it('names a parent without a useful title from its text', () => {
    const generic = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 6, title: "Murphy's Law", text: 'Parent text.' } }, PLAIN);
    expect(generic).toContain('Corollary of: #6 "Parent text."');
    const untitled = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 7, title: null, text: 'Other parent.' } }, PLAIN);
    expect(untitled).toContain('Corollary of: #7 "Other parent."');
    const placeholder = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 8, title: 'Untitled', text: 'Third parent.' } }, PLAIN);
    expect(placeholder).toContain('Corollary of: #8 "Third parent."');
  });

  it.each(['  CoRoLLary ', 'Untitled', 'Murphys Law', "Murphy's Laws", 'law'])('does not print the generic title %j on a corollary', (title) => {
    const out = formatLaw({ id: 5, text: 'Parent.', corollaries: [{ id: 12, title, text: 'Child text.', upvotes: 0, downvotes: 0 }] }, PLAIN);
    expect(out).toContain('- #12: Child text. (+0)');
  });

  it('cuts a long parent text used in place of a generic title', () => {
    const out = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 5, title: null, text: 'word '.repeat(60) } }, PLAIN);
    const line = out.split('\n').find((l) => l.startsWith('Corollary of:')) as string;
    expect(line.endsWith('..."')).toBe(true);
    expect(line.length).toBeLessThan(130);
  });

  it('prints no corollary lines when there are none', () => {
    expect(formatLaw({ id: 5, text: 'Plain.', corollaries: [], corollary_of: null }, PLAIN)).not.toContain('Corollar');
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
