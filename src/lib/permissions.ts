import type { Profile } from "@/lib/types";

function roleList(p: Profile | null): string[] {
  if (!p?.roles) return [];
  return Array.isArray(p.roles) ? p.roles.map(String) : [];
}

export function isAdmin(p: Profile | null): boolean {
  return roleList(p).includes("admin");
}

export function canPostCinema(p: Profile | null): boolean {
  const r = roleList(p);
  return r.includes("admin") || r.includes("cinema_poster");
}

/** Any signed-in user may post poetry (RLS still requires `posted_by = auth.uid()`). */
export function canPostPoetry(userId: string | null): boolean {
  return userId != null;
}
