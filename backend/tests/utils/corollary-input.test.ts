import { describe, expect, it } from 'vitest';
import { BodyError, parseCorollaryList, parseText, parseTitle } from '../../src/utils/corollary-input.ts';

const PARENT = 'A red light turns green right after you stop watching it.';
const ONE = 'The engine restarts slowly when someone behind you is honking.';

describe('corollary request rules', () => {
  it('requires a string text of 10 to 1000 characters once trimmed', () => {
    expect(parseText('  ten chars!  ', 'Law text', 'must be text')).toBe('ten chars!');
    expect(() => parseText(5, 'Law text', 'must be text')).toThrow(new BodyError('must be text'));
    expect(() => parseText('short', 'Law text', 'x')).toThrow('Law text must be between 10 and 1000 characters');
    expect(() => parseText('x'.repeat(1001), 'Law text', 'x')).toThrow(BodyError);
  });

  it('treats a blank or null title as none and refuses a long or non-string one', () => {
    expect(parseTitle(null, 'Title', 'x')).toBeNull();
    expect(parseTitle('   ', 'Title', 'x')).toBeNull();
    expect(parseTitle(' Name ', 'Title', 'x')).toBe('Name');
    expect(parseTitle('t'.repeat(200), 'Title', 'x')).toHaveLength(200);
    expect(() => parseTitle('t'.repeat(201), 'Title', 'x')).toThrow('Title must be at most 200 characters');
    expect(() => parseTitle(4, 'Title', 'must be a string')).toThrow('must be a string');
  });

  it('words the count rule by the minimum: a split needs one, a submission may carry none', () => {
    expect(() => parseCorollaryList([], PARENT, 1)).toThrow('Provide between 1 and 5 corollaries');
    expect(parseCorollaryList([], PARENT, 0)).toEqual([]);
    const six = [1, 2, 3, 4, 5, 6].map((n) => ({ text: `Corollary number ${n} of the law` }));
    expect(() => parseCorollaryList(six, PARENT, 0)).toThrow('Provide at most 5 corollaries');
    expect(() => parseCorollaryList(six, PARENT, 1)).toThrow('Provide between 1 and 5 corollaries');
  });

  it('numbers problems by position in the list it was given, and returns trimmed entries', () => {
    expect(parseCorollaryList([{ title: ' Name ', text: ` ${ONE} ` }, { text: 'Another corollary of the law' }], PARENT, 0)).toEqual([
      { title: 'Name', text: ONE },
      { title: null, text: 'Another corollary of the law' },
    ]);
    expect(() => parseCorollaryList([{ text: ONE }, { text: ` ${ONE.toUpperCase()} ` }], PARENT, 0)).toThrow('Corollary 2 repeats another corollary or the law text');
    expect(() => parseCorollaryList([{ text: PARENT }], PARENT, 0)).toThrow('Corollary 1 repeats');
    expect(() => parseCorollaryList('nope', PARENT, 0)).toThrow('corollaries must be a list');
  });
});
