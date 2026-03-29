import type { Profile } from "@/lib/types";

function roleList(p: Profile | null): string[] {
  if (!p?.roles) return [];
  return Array.isArray(p.roles) ? p.roles.map(String) : [];
}

export function isAdmin(p: Profile | null): boolean {
  return roleList(p).includes("admin");
}

/** Any signed-in user may post cinema buzz (RLS requires a `profiles` row and `posted_by = auth.uid()`). */
export function canPostCinema(userId: string | null): boolean {
  return userId != null;
}

/** Any signed-in user may post poetry (RLS still requires `posted_by = auth.uid()`). */
export function canPostPoetry(userId: string | null): boolean {
  return userId != null;
}
