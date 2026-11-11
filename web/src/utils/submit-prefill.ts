/** The most law text the submit form accepts, and so the most worth carrying in a URL. */
export const SUBMIT_PREFILL_MAX_LENGTH = 1000;

/** URL of the submit page that starts from the given text, such as the words of a search that found nothing. */
export function submitPrefillUrl(text: string): string {
  return `/submit?${new URLSearchParams({ text: text.slice(0, SUBMIT_PREFILL_MAX_LENGTH) })}`;
}

/**
 * Reads the starting text from the `text` query parameter and removes it from the address, so a later re-render,
 * reload or return to the page starts from an empty form instead of the old words.
 */
export function consumeSubmitPrefillText(): string | undefined {
  const params = new URLSearchParams(location.search);
  const text = params.get('text');
  if (text === null) return undefined;
  params.delete('text');
  const search = params.toString();
  history.replaceState(history.state ?? {}, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  return text;
}
