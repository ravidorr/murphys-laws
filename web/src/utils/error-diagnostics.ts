// TEMPORARY (Kindle diagnosis): the Kindle browser has no dev tools, so the error banner can print
// the underlying error. Remove once the root cause is fixed.

const MAX_ENTRIES = 5;
const MAX_MESSAGE_LENGTH = 160;

/** On for Kindle/Silk browsers, or anywhere when the URL has `?diag=1`. */
export function isDiagnosticEnabled(userAgent: string, search: string): boolean {
  return /Kindle|Silk/i.test(userAgent) || new URLSearchParams(search).get('diag') === '1';
}

function stringify(value: unknown): string {
  try {
    return value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  } catch {
    return '[unprintable]';
  }
}

/** Truncates the message, then appends the location so the location is never cut off. */
export function describeError(kind: string, value: unknown, filename?: string, lineno?: number): string {
  const msg = stringify(value).slice(0, MAX_MESSAGE_LENGTH);
  const where = filename ? ` @${filename.split('/').slice(-2).join('/')}:${lineno ?? '?'}` : '';
  return `${kind} ${msg}${where}`;
}

export function createDiagnosticLog(): { add: (detail: string) => string; text: () => string } {
  const entries: string[] = [];
  const text = (): string => entries.join(' | ');
  return {
    add(detail: string): string {
      if (entries.length < MAX_ENTRIES) entries.push(detail);
      return text();
    },
    text,
  };
}
