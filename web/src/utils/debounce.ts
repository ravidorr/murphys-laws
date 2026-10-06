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

/**
 * Debounced task that can also be flushed: schedule() (re)starts the wait, and flush() runs a
 * pending task immediately, e.g. when a view unmounts before the wait has elapsed.
 */
export function createDebouncedTask(task: () => void, wait: number): { schedule: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function run() {
    timeoutId = undefined;
    task();
  }

  return {
    schedule() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(run, wait);
    },
    flush() {
      if (timeoutId === undefined) return;
      clearTimeout(timeoutId);
      run();
    },
  };
}
