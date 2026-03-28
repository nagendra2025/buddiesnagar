/** PostgREST sometimes returns embedded FK as object or single-element array. */
export function oneEmbedded<T extends object>(
  p: T | T[] | null | undefined,
): T | null {
  if (p == null) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}
