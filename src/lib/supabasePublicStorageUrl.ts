const PUBLIC_MARKER = "/storage/v1/object/public/";

/** Parse a Supabase public object URL into bucket + object path (for Storage API remove). */
export function parseSupabasePublicObjectUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(PUBLIC_MARKER);
    if (idx === -1) return null;
    const rest = u.pathname.slice(idx + PUBLIC_MARKER.length);
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const bucket = rest.slice(0, slash);
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
