import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One browser client per tab. Multiple `createBrowserClient()` instances fight over the
 * same gotrue-js storage lock and log "Lock ... was not released within 5000ms"
 * (worse under React Strict Mode double-mount in dev).
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (typeof window === "undefined") {
    return createBrowserClient(url, key);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
