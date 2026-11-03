/**
 * Funny 404 lines. Shown on the 404 page. The static build uses the default line; the app picks one at random.
 */
export const DEFAULT_NOT_FOUND_LINE =
  "This page was here a minute ago. Murphy's Law says that is exactly when it left.";

export const NOT_FOUND_LINES: readonly string[] = [
  DEFAULT_NOT_FOUND_LINE,
  'You found the one URL that can go wrong. Congratulations.',
  'Whatever you were looking for is in the last place you would look. It turns out to be empty.',
  'Nothing to see here, which is exactly what Murphy would have predicted.',
  'The link worked perfectly right up until you needed it.',
  'If a link can break, it will break, right after you click it.',
  'Every page you do not need loads instantly. This one just does not load.',
  'A typo and a moved page walk into a browser. Nobody gets what they wanted.',
];

export function pickNotFoundLine(random: () => number = Math.random): string {
  const index = Math.floor(random() * NOT_FOUND_LINES.length);
  return NOT_FOUND_LINES[Math.min(index, NOT_FOUND_LINES.length - 1)]!;
}
