/**
 * Debounce utility function
 * Creates a debounced version of a function that delays execution until after wait milliseconds
 * have elapsed since the last time it was invoked.
 */
export function debounce<A extends readonly unknown[]>(
  func: (...args: A) => unknown,
  wait = 240
): (...args: A) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(this: unknown, ...args: A) {
    const context = this;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func.call(context, ...args);
    }, wait);
  };
}
