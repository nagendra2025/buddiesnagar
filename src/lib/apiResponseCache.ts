import { createServiceClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function readCachedJson<T>(
  cacheKey: string,
  maxAgeMs: number,
): Promise<{ body: T; fetchedAt: string } | null> {
  const svc = createServiceClient();
  if (!svc) return null;

  const { data, error } = await svc
    .from("api_response_cache")
    .select("body, fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error) {
    logger.warn("apiResponseCache", "read failed", {
      cacheKey,
      message: error.message,
    });
    return null;
  }
  if (!data?.fetched_at || data.body === null || data.body === undefined) {
    return null;
  }
  const age = Date.now() - Date.parse(String(data.fetched_at));
  if (age > maxAgeMs) return null;
  return { body: data.body as T, fetchedAt: String(data.fetched_at) };
}

export async function writeCachedJson(cacheKey: string, body: unknown): Promise<void> {
  const svc = createServiceClient();
  if (!svc) return;

  const { error } = await svc.from("api_response_cache").upsert(
    {
      cache_key: cacheKey,
      body: body as object,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
  if (error) {
    logger.warn("apiResponseCache", "write failed", {
      cacheKey,
      message: error.message,
    });
  }
}
