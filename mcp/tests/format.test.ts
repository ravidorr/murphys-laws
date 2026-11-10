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

  it('lists the corollaries of a law with their ids and titles', () => {
    const out = formatLaw({
      id: 5,
      text: 'Parent.',
      corollaries: [
        { id: 11, title: 'The Ignition Corollary', text: 'Restart feels slow.', upvotes: 3, downvotes: 1 },
        { id: 12, title: 'Corollary', text: 'The light stays green.', upvotes: 0, downvotes: 0 },
        { id: 13, title: null, text: 'No title at all.', upvotes: 1, downvotes: 0 },
        { id: 14, title: 'Disliked', text: 'Nobody likes this one.', upvotes: 0, downvotes: 2 },
      ],
    });
    expect(out).toContain('Corollaries (4):');
    expect(out).toContain('- #11 The Ignition Corollary: Restart feels slow. (+2)');
    expect(out).toContain('- #12: The light stays green. (+0)');
    expect(out).toContain('- #13: No title at all. (+1)');
    expect(out).toContain('- #14 Disliked: Nobody likes this one. (-2)');
    expect(out.indexOf('Corollaries (4):')).toBeLessThan(out.indexOf('Source:'));
  });

  it('names the parent of a corollary', () => {
    const out = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 5, title: 'Start-Stop', text: 'Parent text.' } });
    expect(out).toContain('Corollary of: #5 Start-Stop');
  });

  it('names a parent without a useful title from its text', () => {
    const generic = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 6, title: "Murphy's Law", text: 'Parent text.' } });
    expect(generic).toContain('Corollary of: #6 "Parent text."');
    const untitled = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 7, title: null, text: 'Other parent.' } });
    expect(untitled).toContain('Corollary of: #7 "Other parent."');
    const placeholder = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 8, title: 'Untitled', text: 'Third parent.' } });
    expect(placeholder).toContain('Corollary of: #8 "Third parent."');
  });

  it.each(['  CoRoLLary ', 'Untitled', 'Murphys Law', "Murphy's Laws", 'law'])('does not print the generic title %j on a corollary', (title) => {
    const out = formatLaw({ id: 5, text: 'Parent.', corollaries: [{ id: 12, title, text: 'Child text.', upvotes: 0, downvotes: 0 }] });
    expect(out).toContain('- #12: Child text. (+0)');
  });

  it('cuts a long parent text used in place of a generic title', () => {
    const out = formatLaw({ id: 11, text: 'Child.', corollary_of: { id: 5, title: null, text: 'word '.repeat(60) } });
    const line = out.split('\n').find((l) => l.startsWith('Corollary of:')) as string;
    expect(line.endsWith('..."')).toBe(true);
    expect(line.length).toBeLessThan(130);
  });

  it('prints no corollary lines when there are none', () => {
    const out = formatLaw({ id: 5, text: 'Plain.', corollaries: [], corollary_of: null });
    expect(out).not.toContain('Corollar');
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
