export function safeParseJsonArray<T = unknown>(s: unknown): T[] {
  try {
    const v = typeof s === 'string' ? JSON.parse(s) : s;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
