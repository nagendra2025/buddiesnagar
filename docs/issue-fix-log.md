# Issue & fix log

This document records problems reported for BuddyNagar, what changed (if anything), and why.

**Maintenance:** Append a new dated `##` section whenever you fix a user-facing bug, clarify confusing behavior, or ship a notable behavior/UI change tied to a reported issue. Do this as part of the same change set when possible—**the user should not have to ask for log updates.**

Also keep `docs/phasewise.md` in sync when work maps to a PRD phase; this file is for **incidents, root causes, and fixes** in narrative form.

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

## 2026-03-29 — Production: news section empty on Vercel (NewsAPI vs RSS)

**Reported:** No headlines on `buddiesnagar.vercel.app` even with `NEWS_API_KEY` set in Vercel; old copy always said to add the key.

**Cause:** NewsAPI.org **free Developer** plan is for development only; requests from production hosts (e.g. Vercel) often fail with **HTTP 426** (or similar), so the server got **zero articles** and **no cache rows** per category. The subtitle under “Today’s news” was **static** and did not reflect whether the key was present.

**Fix:**

- **RSS fallback** — `src/lib/news/rssFallback.ts`: if NewsAPI yields no usable articles, fetch **public RSS feeds** mapped by category (e.g. BBC, The Hindu Telangana, NDTV India), parse without new npm dependencies, return the same `NewsArticle` shape, and **insert into `news_articles_cache`** like NewsAPI results.
- **`GET /api/news`** — Surface `newsApiHttpStatus`, `newsApiErrorCode`, `missingNewsApiKey` on failure paths; treat NewsAPI JSON `{ status: "error" }` as failure; if live articles exist but **Supabase service role** is missing, **still return those articles** (do not drop them and fall through to empty stale).
- **News UI** — Neutral caching blurb; when responses use RSS, set `usedRssFallback` and explain briefly; keep targeted hints for missing key, 426, and 401 / `apiKeyInvalid`.

**Files:** `src/lib/news/rssFallback.ts`, `src/app/api/news/route.ts`, `src/components/sections/NewsSection.tsx`

---

## 2026-03-29 — News & Cinema: horizontal carousel (prev / next)

**Requested:** Show headline and cinema cards in a **horizontal row** with **left / right** navigation for the selected category or filter, instead of a 2-column grid of all items at once.

**Fix:** New `HorizontalCarousel` in `src/components/ui/horizontal-carousel.tsx` — horizontal `overflow-x` strip with scroll-snap, hidden scrollbars, chevron buttons, disabled state at the ends, and `scrollResetKey` to reset scroll when category/filter or list identity changes. Integrated into **NewsSection** (including loading skeletons) and **CinemaNewsSection**.

**Files:** `src/components/ui/horizontal-carousel.tsx`, `src/components/sections/NewsSection.tsx`, `src/components/sections/CinemaNewsSection.tsx`

---

## 2026-03-29 — “Add post” buttons missing for cinema / poetry / memory

**Reported:** Post / Add icons appeared once, then seemed to disappear.

**Cause (by design):**

1. **Poets corner & Memory lane** — The server passes `userId` from `supabase.auth.getUser()`. If there is **no active session** (magic link expired, different browser/device, cookies cleared, or not signed in), `userId` is `null` and the **Post a poem** / **Add a memory** buttons are hidden.
2. **Cinema buzz** — Uses `canPostCinema(myProfile)`, which requires `profiles.roles` to include **`admin`** or **`cinema_poster`**. Signed-in **members** without those roles never see **Post update**, even when poetry/memory buttons show.

**UX follow-up:** When posting is not available, each section now shows a short **muted explanation** (sign-in link to `#hero`, or cinema role note) instead of an empty header area.

**Files:** `src/components/sections/CinemaNewsSection.tsx`, `src/components/sections/PoetryWallSection.tsx`, `src/components/sections/MemoryLaneSection.tsx`

---

## 2026-03-29 — Returning users: unclear where to “sign in” at `#hero`

**Reported:** Links said “Sign in (hero section)” but the hero only showed the invite wall (“tap your name”), which feels like first-time registration, not a quick session refresh.

**Fix:**

- **`#sign-in` block** in `HeroRegistration`: email field + **Email login link** calls `signInWithOtp` **without** `master_friend_id` / `full_name` metadata — same magic-link flow as registration, but for **existing** Supabase auth users only.
- Hidden when `isSignedIn` (passed from `page.tsx`).
- **Site nav:** **Log in** → `#sign-in` when logged out.
- Cinema / poetry / memory hints now link **Get login link** → `#sign-in` with shorter copy.

**Files:** `src/components/sections/HeroRegistration.tsx`, `src/app/page.tsx`, `src/components/shared/SiteNav.tsx`, `src/components/sections/CinemaNewsSection.tsx`, `src/components/sections/PoetryWallSection.tsx`, `src/components/sections/MemoryLaneSection.tsx`

---

## 2026-03-29 — Email + password login (avoid checking mail every visit)

**Requested:** “Back again?” should log in on the page with email + password; first join should set password; optional explicit **Log out**; closing the browser is fine otherwise.

**Approach:**

- **Join (names on the wall):** Dialog collects **email + password + confirm** → `supabase.auth.signUp` with the same `user_metadata` (`master_friend_id`, `full_name`) as the old OTP flow. Optional **Prefer a one-time email link?** still calls `signInWithOtp` for edge cases.
- **Back again?:** **Email + password** → `signInWithPassword`, then `router.refresh()`. Collapsible **No password yet?** sends a one-time magic link (legacy accounts or no password set).
- **Nav:** **`SiteNavAuth`** — **Log out** calls `signOut` + refresh when signed in; **Log in** still links to `#sign-in`.

**Supabase:** Email provider must allow passwords; if **Confirm email** is enabled, the first sign-up may require one inbox click before password login works (documented in `README.md`).

**Files:** `src/components/sections/HeroRegistration.tsx`, `src/components/shared/SiteNavAuth.tsx`, `src/components/shared/SiteNav.tsx`, `README.md`

---

## 2026-03-29 — Profile completion: mandatory names, nickname, full birth date

**Requested:** First-time profile step should require password (already collected on account creation), email ID (shown read-only from auth), first/last name, nickname, birth month/day/year, with location optional.

**Changes:**

- **Migration `010_profile_names_nickname_birthyear.sql`:** columns `first_name`, `last_name`, `nickname`, `birthday_year`; `complete_registration` replaced to accept those fields, validate calendar dates via `make_date`, and set `full_name` to `first_name || ' ' || last_name`.
- **`ProfileCompletionForm`:** read-only email, required first/last/nickname/birth month-day-year; location (city) and phone/bio optional; copy explains password was set when creating the account.
- **`POST /api/profile/complete`:** Zod + RPC wiring for new payload.

**Files:** `supabase/migrations/010_profile_names_nickname_birthyear.sql`, `src/components/shared/ProfileCompletionForm.tsx`, `src/app/api/profile/complete/route.ts`, `src/lib/types/index.ts`, `src/components/sections/HeroRegistration.tsx`, `src/app/page.tsx`, `README.md`, `docs/issue-fix-log.md`

---

## 2026-03-29 — Spotlight: birthdays + all festival/special wishes same day

**Requested:** Show birthday wishes for the whole day when a member’s birthday matches; show festival/special days in the same card, combined creatively.

**Fix:** `SpotlightSection` no longer uses `else if` between birthdays and wishes. It collects **all** `wishes` rows matching today (`wishMatchesToday`), renders a **birthday panel** (avatars, nickname preference, warm copy) when any profile matches month/day, then an **“Also on the calendar”** divider and **one block per matching wish** (type badge, emoji, title, message, optional `banner_color` accent). Quiet state explains adding rows to `wishes`.

**Files:** `src/components/sections/SpotlightSection.tsx`, `docs/issue-fix-log.md`

---

## 2026-03-29 — Wishes seed: Indian festivals & national/special days

**Requested:** Populate `wishes` so Spotlight can show famous Indian festivals and special days alongside birthdays.

**Change:** Migration `011_indian_festivals_wishes.sql` inserts ~23 idempotent rows (`where not exists` on `title`): New Year, Sankranti/Pongal, Republic Day, Women’s Day, Holi, Ugadi/Gudi Padwa, Ram Navami, Ambedkar Jayanti, Labour Day, Yoga Day, Guru Purnima, Independence Day, Rakhi, Janmashtami, Teachers’ Day, Ganesh Chaturthi, Onam, Gandhi Jayanti, Dussehra, Diwali, Children’s Day, Guru Nanak Jayanti, Christmas. Header comment notes lunar-date drift; Spotlight badge supports `national` type.

**Files:** `supabase/migrations/011_indian_festivals_wishes.sql`, `src/components/sections/SpotlightSection.tsx`, `README.md`, `docs/issue-fix-log.md`

---

## 2026-03-29 — “Back again?” card: compact layout + Log in beside password

**Requested:** Log in button immediately after password field; reduce wasted card width/height (~half feel); pre-deploy checks.

**Changes:** Sign-in card uses `max-w-lg`, tighter padding/copy; **Email | Password | Log in** on one row from `sm` breakpoint (`flex` + `items-end`); smaller labels/inputs (`h-10`, `text-xs`); condensed magic-link footer. **Lint:** `NewsSection` category fetch deferred with `setTimeout(0)` to satisfy `react-hooks/set-state-in-effect`; `InputProps` as `type` alias for `@typescript-eslint/no-empty-object-type`.

**Files:** `src/components/sections/HeroRegistration.tsx`, `src/components/sections/NewsSection.tsx`, `src/components/ui/input.tsx`, `docs/issue-fix-log.md`

---
