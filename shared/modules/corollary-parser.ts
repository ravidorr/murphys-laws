/**
 * Detects corollaries inside the text of a submitted law.
 *
 * Pure and dependency free, so the backend (admin split) and the web form (submitter hint) can share one rule set.
 * Detection is by BULLET, not by the word "Corollary": a law whose text is a sentence followed by bulleted lines
 * is a split candidate. The result only ever seeds a review screen; nothing is split without a person's say-so.
 */

/** A parent law may carry at most this many corollaries. */
export const MAX_COROLLARIES_PER_PARENT = 5;
/** Every law, parent or corollary, must be at least this long after trimming. */
export const COROLLARY_TEXT_MIN_LENGTH = 10;
/** Every law, parent or corollary, must be at most this long after trimming. */
export const COROLLARY_TEXT_MAX_LENGTH = 1000;
/** A corollary title is at most this long. */
export const COROLLARY_TITLE_MAX_LENGTH = 200;
/** Text before the first bullet must reach this length, or there is no parent law to attach corollaries to. */
export const MIN_PARENT_TEXT_LENGTH = COROLLARY_TEXT_MIN_LENGTH;

export interface CorollaryItem {
  /** The label before the first colon of a labeled bullet; null for an unlabeled one. */
  title: string | null;
  /** The bullet text. For an unlabeled bullet this is the whole bullet, so keeping it in the parent loses nothing. */
  text: string;
  /** True when the bullet starts with a corollary label such as `The Ignition Corollary:`. */
  labeled: boolean;
}

export interface ParsedCorollaries {
  /** The text before the first bullet, trimmed. Empty when the text starts with a bullet. */
  parentText: string;
  /** One entry per bullet, in order. May hold more than MAX_COROLLARIES_PER_PARENT; the caller decides. */
  items: CorollaryItem[];
}

/**
 * `•`, `-`, `*`, `–` (en dash), `1.` or `1)` (one or two digits, so a wrapped line starting with a year is not a
 * bullet), followed by whitespace or the end of the line. `**bold**`, `-5` and `1.5` are not bullets.
 */
const BULLET_LINE = /^\s*(?:[•*–-]|\d{1,2}[.)])(?:\s+(.*))?$/;
/**
 * The label expressions `backend/scripts/build-sqlite.ts` uses for imported laws. The import script splits a title
 * off every bullet that has a colon; the parser does it only for Corollary-labeled bullets, so a bullet such as
 * `Note: ...` or `Corollary 2: ...` stays whole.
 */
const COROLLARY_LABEL = /^([A-Za-z][^:]{0,60})?\s*Corollary\s*:\s*/i;
const LABEL_AND_TEXT = /^([^:]{3,}?)\s*:\s*(.+)$/;

function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toItem(bullet: string): CorollaryItem {
  if (COROLLARY_LABEL.test(bullet)) {
    const match = LABEL_AND_TEXT.exec(bullet);
    if (match) {
      return { title: match[1].trim(), text: match[2].trim(), labeled: true };
    }
  }
  return { title: null, text: bullet, labeled: false };
}

/**
 * Splits law text into the parent sentence and its bullets.
 *
 * Lines after the first bullet that are not bullets themselves (wrapped lines, or a closing paragraph after a blank
 * line) are joined onto the bullet above them, so no text is dropped; a closing paragraph therefore ends up inside the
 * last bullet, where the person reviewing the split can edit it. A marker with nothing after it is an empty bullet
 * and is dropped.
 */
export function parseCorollaries(input: string): ParsedCorollaries {
  const lines = input.split(/\r\n|[\r\n\u2028\u2029]/);
  const parentLines: string[] = [];
  const bullets: string[] = [];

  for (const line of lines) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      bullets.push(bullet[1] ?? '');
    } else if (bullets.length === 0) {
      parentLines.push(line);
    } else if (line.trim() !== '') {
      bullets[bullets.length - 1] += ` ${line}`;
    }
  }

  const items = bullets.map(squash).filter((bullet) => bullet !== '').map(toItem);
  return { parentText: parentLines.join('\n').trim(), items };
}

/**
 * True when there is a real parent sentence and at least one bullet, so a review screen is worth showing. It does not
 * check the number of bullets or their lengths: the caller shows those problems and enforces the shared limits.
 */
export function canOfferSplit(parsed: ParsedCorollaries): boolean {
  return parsed.items.length > 0 && parsed.parentText.length >= MIN_PARENT_TEXT_LENGTH;
}
