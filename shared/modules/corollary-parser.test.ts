import { describe, expect, it } from 'vitest';
import {
  canOfferSplit,
  COROLLARY_TEXT_MAX_LENGTH,
  COROLLARY_TEXT_MIN_LENGTH,
  COROLLARY_TITLE_MAX_LENGTH,
  MAX_COROLLARIES_PER_PARENT,
  MIN_PARENT_TEXT_LENGTH,
  parseCorollaries
} from './corollary-parser';

const PARENT = 'Any fix applied on a Friday afternoon will break something by Monday morning.';

// Modeled on the shape of real submissions: a law sentence, a blank line, then labeled bullets.
const LABELED = [
  PARENT,
  '',
  '• The Ignition Corollary: The harder you press the deploy button, the less it matters.',
  '• The Rollback Corollary: The previous version always had the bug you just fixed.'
].join('\n');

describe('corollary parser constants', () => {
  it('exports the shared limits', () => {
    expect(MAX_COROLLARIES_PER_PARENT).toBe(5);
    expect(COROLLARY_TEXT_MIN_LENGTH).toBe(10);
    expect(COROLLARY_TEXT_MAX_LENGTH).toBe(1000);
    expect(COROLLARY_TITLE_MAX_LENGTH).toBe(200);
    expect(MIN_PARENT_TEXT_LENGTH).toBe(10);
  });
});

describe('parseCorollaries', () => {
  it('splits a law sentence from its labeled bullets', () => {
    expect(parseCorollaries(LABELED)).toEqual({
      parentText: PARENT,
      items: [
        { title: 'The Ignition Corollary', text: 'The harder you press the deploy button, the less it matters.', labeled: true },
        { title: 'The Rollback Corollary', text: 'The previous version always had the bug you just fixed.', labeled: true }
      ]
    });
  });

  it('recognizes every bullet marker', () => {
    const markers: Array<[string, string]> = [
      ['bullet', '•'],
      ['hyphen', '-'],
      ['asterisk', '*'],
      ['en dash', '–'],
      ['number and dot', '1.'],
      ['number and parenthesis', '2)'],
      ['multi-digit number', '12.']
    ];
    for (const [name, marker] of markers) {
      const parsed = parseCorollaries(`${PARENT}\n${marker} Things only get worse from here.`);
      expect(parsed.items, name).toEqual([{ title: null, text: 'Things only get worse from here.', labeled: false }]);
      expect(parsed.parentText, name).toBe(PARENT);
    }
  });

  it('does not treat markup, negative numbers or decimals as bullets', () => {
    const text = `${PARENT}\n**Important** note about this law.\n-5 degrees is cold.\n1.5 liters is plenty.`;
    expect(parseCorollaries(text)).toEqual({ parentText: text, items: [] });
  });

  it('keeps unlabeled bullets whole', () => {
    const parsed = parseCorollaries(`${PARENT}\n\n- Nothing is ever as simple as it first looks.\n- A bullet with a note: still no corollary label.`);
    expect(parsed.items).toEqual([
      { title: null, text: 'Nothing is ever as simple as it first looks.', labeled: false },
      { title: null, text: 'A bullet with a note: still no corollary label.', labeled: false }
    ]);
  });

  it('mixes labeled and unlabeled bullets in order', () => {
    const parsed = parseCorollaries(`${PARENT}\n\n• Corollary: Plan for the worst.\n• Just an aside about the weather.\n* The Last Corollary: It ends here.`);
    expect(parsed.items.map((item) => [item.title, item.labeled])).toEqual([
      ['Corollary', true],
      [null, false],
      ['The Last Corollary', true]
    ]);
  });

  it('joins continuation lines onto the bullet above, including a closing paragraph', () => {
    const text = [
      PARENT,
      '',
      '• The Ignition Corollary: The harder you press',
      '   the deploy button,   the less it matters.',
      '• Another unlabeled thought that wraps',
      'onto a second line.',
      '',
      'Sent by someone helpful.'
    ].join('\n');
    expect(parseCorollaries(text).items).toEqual([
      { title: 'The Ignition Corollary', text: 'The harder you press the deploy button, the less it matters.', labeled: true },
      { title: null, text: 'Another unlabeled thought that wraps onto a second line. Sent by someone helpful.', labeled: false }
    ]);
  });

  it('numbers bullets the same way as symbols', () => {
    const parsed = parseCorollaries(`${PARENT}\n1. The First Corollary: Start early.\n2) The Second Corollary: Finish late.`);
    expect(parsed.items.map((item) => item.title)).toEqual(['The First Corollary', 'The Second Corollary']);
  });

  it('returns no items when the text has no bullets', () => {
    expect(parseCorollaries(PARENT)).toEqual({ parentText: PARENT, items: [] });
    expect(parseCorollaries('')).toEqual({ parentText: '', items: [] });
  });

  it('leaves the parent text empty when the text starts with a bullet', () => {
    const parsed = parseCorollaries('• The Only Corollary: There is no parent sentence here.');
    expect(parsed.parentText).toBe('');
    expect(parsed.items).toHaveLength(1);
  });

  it('keeps every bullet when there are more than the allowed maximum', () => {
    const bullets = Array.from({ length: 7 }, (_, i) => `• The Number ${i + 1} Corollary: Detail number ${i + 1}.`);
    const parsed = parseCorollaries([PARENT, '', ...bullets].join('\n'));
    expect(parsed.items.map((item) => item.text)).toEqual(Array.from({ length: 7 }, (_, i) => `Detail number ${i + 1}.`));
    expect(parsed.items.length).toBeGreaterThan(MAX_COROLLARIES_PER_PARENT);
    expect(canOfferSplit(parsed)).toBe(true);
  });

  it('treats a label with no text after the colon as an unlabeled bullet', () => {
    expect(parseCorollaries(`${PARENT}\n• Corollary:`).items).toEqual([{ title: null, text: 'Corollary:', labeled: false }]);
  });

  it('does not turn a wrapped line that starts with a year into a bullet', () => {
    const text = 'Work expands to fill the time\navailable, as of\n2010. Then more.';
    expect(parseCorollaries(text)).toEqual({ parentText: text, items: [] });
  });

  it('drops a bare marker with no trailing space, before and after the first bullet', () => {
    for (const marker of ['•', '-', '*', '–', '1.', '2)']) {
      const parsed = parseCorollaries(`${PARENT}\n${marker}\n${marker} Real corollary text goes here.\n${marker}`);
      expect(parsed, marker).toEqual({
        parentText: PARENT,
        items: [{ title: null, text: 'Real corollary text goes here.', labeled: false }]
      });
    }
  });

  it('treats a bullet separated by a Unicode line or paragraph separator as a bullet', () => {
    expect(parseCorollaries(`${PARENT}\u2028• Corollary: Split by a line separator.\u2029• Another one after a paragraph separator.`).items)
      .toEqual([
        { title: 'Corollary', text: 'Split by a line separator.', labeled: true },
        { title: null, text: 'Another one after a paragraph separator.', labeled: false }
      ]);
  });

  it('accepts indented bullets and a tab after the marker', () => {
    expect(parseCorollaries(`${PARENT}\n    • Indented corollary text here.\n\t-\tTabbed corollary text here.`).items.map((i) => i.text))
      .toEqual(['Indented corollary text here.', 'Tabbed corollary text here.']);
  });

  it('does not recognize other dash or dot characters as bullet markers', () => {
    for (const marker of ['—', '◦', '▪', '·']) {
      const text = `${PARENT}\n${marker} Not a supported marker here.`;
      expect(parseCorollaries(text), marker).toEqual({ parentText: text, items: [] });
    }
  });

  it('labels only bullets whose label ends in the word Corollary followed by a colon', () => {
    const cases: Array<[string, string | null]> = [
      ['corollary: lowercase label works.', 'corollary'],
      ['THE LOUD COROLLARY: Uppercase label works.', 'THE LOUD COROLLARY'],
      ['Corollary 2: A numbered label is not a corollary label.', null],
      ['Note: The Odd Corollary: A colon before the word means no label.', null],
      [`${'a'.repeat(70)} Corollary: A label longer than sixty characters is not a label.`, null]
    ];
    for (const [bullet, title] of cases) {
      const [item] = parseCorollaries(`${PARENT}\n• ${bullet}`).items;
      expect(item.title, bullet).toBe(title);
      expect(item.labeled, bullet).toBe(title !== null);
      if (title === null) expect(item.text, bullet).toBe(bullet);
    }
  });

  it('ignores empty bullets', () => {
    expect(parseCorollaries(`${PARENT}\n•   \n• Real content for the only bullet.`).items).toEqual([
      { title: null, text: 'Real content for the only bullet.', labeled: false }
    ]);
  });

  it('only splits at the first colon', () => {
    expect(parseCorollaries(`${PARENT}\n• The Time Corollary: Note: it takes twice as long.`).items).toEqual([
      { title: 'The Time Corollary', text: 'Note: it takes twice as long.', labeled: true }
    ]);
  });

  it('handles Windows and old Mac line endings', () => {
    expect(parseCorollaries(`${PARENT}\r\n\r\n• The Ignition Corollary: Press harder.\r• The Second Corollary: Press again.`).items).toHaveLength(2);
  });

  it('keeps blank lines inside the parent text and trims its ends', () => {
    expect(parseCorollaries(`\n  First paragraph of the law.\n\nSecond paragraph of the law.\n\n• Corollary: Done.`).parentText)
      .toBe('First paragraph of the law.\n\nSecond paragraph of the law.');
  });
});

describe('canOfferSplit', () => {
  it('offers a split for a parent sentence with bullets', () => {
    expect(canOfferSplit(parseCorollaries(LABELED))).toBe(true);
  });

  it('offers nothing without bullets', () => {
    expect(canOfferSplit(parseCorollaries(PARENT))).toBe(false);
  });

  it('offers nothing without a real parent sentence', () => {
    expect(canOfferSplit(parseCorollaries('• The Only Corollary: There is no parent sentence here.'))).toBe(false);
    expect(canOfferSplit(parseCorollaries('Short.\n• The Only Corollary: Parent is too short.'))).toBe(false);
  });

  it('accepts a parent of exactly the minimum length', () => {
    expect(canOfferSplit(parseCorollaries(`${'a'.repeat(MIN_PARENT_TEXT_LENGTH)}\n• Corollary: Just enough parent.`))).toBe(true);
    expect(canOfferSplit(parseCorollaries(`${'a'.repeat(MIN_PARENT_TEXT_LENGTH - 1)}\n• Corollary: One short.`))).toBe(false);
  });
});
