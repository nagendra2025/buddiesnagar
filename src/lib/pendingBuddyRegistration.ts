/** Survives email-confirm / magic-link round trips if auth user_metadata is missing. */

export const PENDING_BUDDY_STORAGE_KEY = "buddy_nagar_pending_buddy_v1";

export type PendingBuddyPayload = {
  master_friend_id: string;
  full_name: string;
  email: string;
};

export function savePendingBuddy(payload: PendingBuddyPayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_BUDDY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPendingBuddy(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_BUDDY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readPendingBuddy(): PendingBuddyPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_BUDDY_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingBuddyPayload>;
    if (
      typeof p.master_friend_id === "string" &&
      p.master_friend_id.length > 0 &&
      typeof p.email === "string" &&
      p.email.length > 0
    ) {
      return {
        master_friend_id: p.master_friend_id,
        full_name: typeof p.full_name === "string" ? p.full_name : "",
        email: p.email.trim().toLowerCase(),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
