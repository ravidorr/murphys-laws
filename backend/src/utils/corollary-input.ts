import {
  COROLLARY_TEXT_MAX_LENGTH,
  COROLLARY_TEXT_MIN_LENGTH,
  COROLLARY_TITLE_MAX_LENGTH,
  MAX_COROLLARIES_PER_PARENT,
} from '../../../shared/modules/corollary-parser.ts';

/*
 * Request-body rules shared by the endpoints that accept corollaries (the admin split and the public submit), so a
 * corollary is held to the same limits wherever it comes from.
 */

/** A request body field broke a rule. The message is safe to show to the caller. */
export class BodyError extends Error {}

export interface CorollaryInput {
  title: string | null;
  text: string;
}

/** Law text and corollary text share one rule: 10 to 1000 characters once trimmed. */
export function parseText(value: unknown, label: string, notString: string): string {
  if (typeof value !== 'string') {
    throw new BodyError(notString);
  }
  const text = value.trim();
  if (text.length < COROLLARY_TEXT_MIN_LENGTH || text.length > COROLLARY_TEXT_MAX_LENGTH) {
    throw new BodyError(`${label} must be between ${COROLLARY_TEXT_MIN_LENGTH} and ${COROLLARY_TEXT_MAX_LENGTH} characters`);
  }
  return text;
}

/** A title is optional: blank or null clears it. */
export function parseTitle(value: unknown, label: string, notString: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new BodyError(notString);
  }
  const title = value.trim();
  if (title.length > COROLLARY_TITLE_MAX_LENGTH) {
    throw new BodyError(`${label} must be at most ${COROLLARY_TITLE_MAX_LENGTH} characters`);
  }
  return title || null;
}

/** Compares texts the way a person would: ignoring case and runs of whitespace. */
const sameText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ');

/**
 * Validates a list of corollaries against the parent's text. `min` is how few are allowed: a split needs one, while a
 * submission may carry none. Titles are optional, texts may not repeat each other or the parent.
 */
export function parseCorollaryList(value: unknown, parentText: string, min: number): CorollaryInput[] {
  if (!Array.isArray(value)) {
    throw new BodyError('corollaries must be a list');
  }
  if (value.length < min || value.length > MAX_COROLLARIES_PER_PARENT) {
    throw new BodyError(
      min === 0
        ? `Provide at most ${MAX_COROLLARIES_PER_PARENT} corollaries`
        : `Provide between ${min} and ${MAX_COROLLARIES_PER_PARENT} corollaries`,
    );
  }
  const seen = new Set([sameText(parentText)]);
  return value.map((entry, index) => {
    const label = `Corollary ${index + 1}`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new BodyError(`${label} must be an object`);
    }
    const text = parseText(entry.text, label, `${label} text must be a string`);
    const title = parseTitle(entry.title ?? null, `${label} title`, `${label} title must be a string or null`);
    const key = sameText(text);
    if (seen.has(key)) {
      throw new BodyError(`${label} repeats another corollary or the law text`);
    }
    seen.add(key);
    return { title, text };
  });
}
