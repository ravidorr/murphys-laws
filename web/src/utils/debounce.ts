/**
 * Debounce utility function
 * Creates a debounced version of a function that delays execution until after wait milliseconds
 * have elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: any[]) => unknown>(func: T, wait = 240): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(this: unknown, ...args: Parameters<T>) {
    const context = this;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
