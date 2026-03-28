import { createServiceClient } from "@/lib/supabase/admin";

/** Signed URLs for admin/uploader preview of files in the private pending bucket. */
export async function signPendingGalleryPreviews(
  pendingPaths: Array<{ id: string; path: string | null }>,
  ttlSeconds: number,
): Promise<Map<string, string>> {
  const svc = createServiceClient();
  const out = new Map<string, string>();
  if (!svc) return out;

  for (const { id, path } of pendingPaths) {
    if (!path) continue;
    const { data, error } = await svc.storage
      .from("buddynagar-gallery-pending")
      .createSignedUrl(path, ttlSeconds);
    if (!error && data?.signedUrl) {
      out.set(id, data.signedUrl);
    }
  }
  return out;
}
