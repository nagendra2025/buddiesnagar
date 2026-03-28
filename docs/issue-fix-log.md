# Issue & fix log

This document records problems reported for BuddyNagar, what changed (if anything), and why. It is **appended over time** when new issues are fixed—no need to ask for updates each time.

---

## 2026-03-28 — Browser overlay: `TypeError: Failed to fetch`

**Reported:** Next.js error overlay on `http://localhost:3000/#news` with `Failed to fetch` and stack frames such as `fetchServerResponse` → `navigateToUnknownRoute` → `navigate`.

**Investigation:** Server logs showed `GET /` and `GET /api/news?category=...` returning **200** with normal timings, so the news route and `NEWS_API_KEY` were not the primary failure mode at that moment.

**Resolution (no repo change):** Treated as **transient dev-client connectivity** to the dev server or **Next.js App Router / RSC refetch** (e.g. dev restart, Turbopack hiccup, stale tab). Recommended: restart `npm run dev`, hard refresh, try incognito; ensure Supabase redirect URLs are set for magic links separately.

**Reasoning:** `Failed to fetch` means no HTTP response reached the browser for that request; Next’s internal navigation fetch can fail independently of `/api/news`. Logs confirmed news was succeeding when the user rechecked.

---

## 2026-03-28 — Console: Missing `Description` or `aria-describedby` for `{DialogContent}`

**Reported:** Browser / Next dev log warning:  
`Warning: Missing Description or aria-describedby={undefined} for {DialogContent}.`  
(often appeared twice under React Strict Mode in development.)

**Fix:**

- Added **`DialogDescription`** to `src/components/ui/dialog.tsx` (Radix `DialogPrimitive.Description`, exported for reuse).
- Used **`DialogDescription`** inside the registration modal in `src/components/sections/HeroRegistration.tsx` under `DialogTitle`, with the magic-link copy moved there; removed the duplicate helper `<p>` under the email field.

**Reasoning:** Radix UI Dialog expects an accessible description linked to the dialog content (for screen readers). Providing `DialogDescription` satisfies that contract and removes the warning without using `aria-describedby={undefined}` to silence it.

**Files touched:** `src/components/ui/dialog.tsx`, `src/components/sections/HeroRegistration.tsx`

---

## 2026-03-28 — Magic link opens Vercel `404 DEPLOYMENT_NOT_FOUND` on `/auth/callback`

**Reported:** After choosing a buddy name (e.g. Nagendra) and submitting email, the Supabase “Confirm your signup” link lands on `https://buddiesnagar.vercel.app/auth/callback?code=...` and shows **404 NOT_FOUND** / **DEPLOYMENT_NOT_FOUND**.

**Cause:** The app sets `emailRedirectTo` to `{current_origin}/auth/callback` (see `HeroRegistration.tsx`). The user opened BuddyNagar on **`buddiesnagar.vercel.app`**, but that Vercel project has **no valid production deployment** (never deployed, deleted, failed build, or wrong team/project).

**Resolution (configuration / ops, not app bug):**

1. **Option A — Use local dev for auth testing:** Open **`http://localhost:3000`**, register from there, and ensure Supabase **Authentication → URL configuration** includes **`http://localhost:3000/auth/callback`** in redirect URLs. The email link will then hit localhost (must have `npm run dev` running when clicking the link).
2. **Option B — Fix Vercel:** In Vercel, confirm the Git repo is connected, the **latest deployment succeeds**, and the production URL is exactly **`buddiesnagar.vercel.app`** (or update Supabase redirect URLs + user bookmark to match the real deployment URL).
3. **Supabase:** **Site URL** and **Redirect URLs** must list every origin you use (localhost + production).

**Reasoning:** Supabase only redirects to allowed URLs; the browser then requests that URL from Vercel. If Vercel has no deployment for that hostname, the callback never reaches Next.js `app/auth/callback/route.ts`.

---

## 2026-03-28 — `@supabase/gotrue-js` storage lock not released (5000ms)

**Reported:** Dev terminal / browser log:  
`Lock "lock:sb-…-auth-token" was not released within 5000ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`

**Cause:** Each call to `createBrowserClient()` creates a **new** Supabase/GoTrue client. Several client sections (`HeroRegistration`, `CinemaNewsSection`, `PoetryWallSection`, `MemoryLaneSection`) all called `createClient()`, which returned **separate instances** that share the same `localStorage` auth state but **contend on the same internal lock**—especially when React Strict Mode mounts/unmounts effects twice in development.

**Fix:** Use a **single browser singleton** in `src/lib/supabase/client.ts`: reuse one `createBrowserClient` per tab when `window` is defined; on the server (if the helper is ever invoked) return a non-cached client to avoid cross-request leakage.

**Files touched:** `src/lib/supabase/client.ts`

**Reasoning:** Supabase’s own Next.js examples often use a factory; for apps with multiple `"use client"` trees touching auth/realtime/storage, one shared browser client removes lock churn. Production builds are less noisy than Strict Mode dev, but the singleton is still correct.

---

## 2026-03-28 — Memory upload: “more than one relationship … `photo_gallery` and `profiles`”

**Reported:** After choosing a photo in Memory lane, insert failed in the browser with PostgREST:  
`Could not embed because more than one relationship was found for 'photo_gallery' and 'profiles'`.

**Cause:** Phase 2 added `photo_gallery_likes` with `user_id` → `profiles`. PostgREST then sees **multiple paths** from `photo_gallery` to `profiles` (e.g. `uploaded_by` and paths via likes). A bare `profiles(full_name)` embed is ambiguous.

**Fix:** Disambiguate every embed with the FK column on the parent row:  
`profiles!uploaded_by(full_name)` for gallery, `profiles!posted_by(full_name)` for cinema/poetry inserts and server selects, `profiles!user_id(full_name)` for suggestions.

**Files touched:** `src/app/page.tsx`, `src/components/sections/MemoryLaneSection.tsx`, `src/components/sections/CinemaNewsSection.tsx`, `src/components/sections/PoetryWallSection.tsx`

---

## 2026-03-28 — Gallery: Resend notify on upload + in-app admin approval

**Requested:** Email the admin when a memory photo is submitted; only gallery uses approval (not cinema/poetry). Use Resend, not Supabase email.

**Changes:**

- **Resend:** `resend` package; `src/lib/gallery-notify-email.ts` sends HTML with preview link to `/#memories`.
- **API (superseded by 004):** Notify is now part of `POST /api/gallery/submit`. `POST /api/gallery/[id]/approve` promotes pending files from private storage to the public gallery.
- **Env:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GALLERY_NOTIFY_EMAIL` (documented in `.env.example`).
- **DB:** `003_gallery_admin_rls.sql` — admins can `SELECT` all gallery rows and `UPDATE` (approve). Required so the admin sees others’ pending uploads and can set `is_approved`.
- **UI:** Admins see **Pending review** with **Approve**; non-admins see **Waiting for approval** for their own uploads. (Upload + email path updated again in the 004 entry below.)

**Files:** `supabase/migrations/003_gallery_admin_rls.sql`, `src/lib/gallery-notify-email.ts`, `src/app/api/gallery/[id]/approve/route.ts`, `src/components/sections/MemoryLaneSection.tsx`, `src/app/page.tsx`, `.env.example`, `README.md`

---

## 2026-03-28 — Gallery: private pending storage + email only for Memory lane

**Requested:** Admin approval email only for Memory lane; photos should not be “live” in the public gallery until approved.

**Changes:** Migration `004_gallery_pending_private_storage.sql` (private bucket `buddynagar-gallery-pending`, nullable `image_url`, `pending_storage_path`, drop client insert policy). `POST /api/gallery/submit` uploads via service role to the private bucket, inserts row, sends Resend to `GALLERY_NOTIFY_EMAIL`. `POST /api/gallery/[id]/approve` copies the object to `buddynagar-gallery`, sets `image_url`, clears `pending_storage_path`. Server generates short-lived signed preview URLs for admin/uploader UI. Removed `POST /api/gallery/notify-pending`.

---

## 2026-03-28 — Cinema, poetry, gallery: 100-hour expiry + cron purge

**Requested:** Auto-remove cinema buzz, poets corner, and memory lane content after 100 hours.

**Implementation:** `CONTENT_TTL_HOURS = 100` in `src/lib/contentTtl.ts`. Home page queries add `.gte(published_at|posted_at|uploaded_at, cutoff)`. Secured `GET|POST /api/cron/purge-expired-posts` deletes older rows via service role, then removes files from `buddynagar-cinema`, `buddynagar-poetry`, `buddynagar-gallery`, and `buddynagar-gallery-pending` (parsed from `image_url` / `pending_storage_path`). `vercel.json` hourly cron; `CRON_SECRET` in env. Section subtitles mention the 100-hour rule.

---

*(End of log — new entries go below this line.)*
