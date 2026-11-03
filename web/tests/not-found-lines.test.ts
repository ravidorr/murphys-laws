import { describe, expect, it } from 'vitest';
import { NOT_FOUND_LINES, pickNotFoundLine } from '../src/utils/not-found-lines.ts';

describe('not-found lines', () => {
  it('picks the first line for 0 and the last for values at or above 1', () => {
    expect(pickNotFoundLine(() => 0)).toBe(NOT_FOUND_LINES[0]);
    expect(pickNotFoundLine(() => 1)).toBe(NOT_FOUND_LINES[NOT_FOUND_LINES.length - 1]);
  });

  it('uses Math.random by default', () => {
    expect(NOT_FOUND_LINES).toContain(pickNotFoundLine());
  });
});
