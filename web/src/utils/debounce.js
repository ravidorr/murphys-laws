/**
 * Debounce utility function
 * Creates a debounced version of a function that delays execution until after wait milliseconds
 * have elapsed since the last time it was invoked.
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay (default: 240)
 * @returns {Function} The debounced function
 */
export function debounce(func, wait = 240) {
  let timeoutId;

  return function debounced(...args) {
    const context = this;

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
