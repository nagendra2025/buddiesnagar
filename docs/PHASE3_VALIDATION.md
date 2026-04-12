# Phase 3 Validation Guide

This document helps you validate each Phase 3 feature independently:

1. Games (Lichess puzzles + WhoFits link)
2. Weather API and widget
3. Cricket API and widget
4. Automated emails (birthday + weekly digest cron, logs, dedupe)
5. Cache behavior for weather/cricket APIs

Use this as a checklist during local validation and after Vercel deployment.

---

## 0) Pre-validation setup

### Required environment variables

Set these in local `.env.local` and in Vercel project env vars:

- `CRON_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `OPENWEATHER_API_KEY`
- one cricket key:
  - `CRICKET_API_KEY` or
  - `CRIC_API_KEY` or
  - `CRICAPI_API_KEY`

Optional but recommended:

- `NEXT_PUBLIC_WHOFITS_URL`
- `NEXT_PUBLIC_LICHESS_PUZZLE_MATE2` / `NEXT_PUBLIC_LICHESS_PUZZLE_MATE3` (Lichess puzzle IDs)
- `WEATHER_QUERY` (default is `Kadapa,IN`)
- `SUPABASE_SERVICE_ROLE_KEY` (enables DB-backed API caching)

### Database migrations

Apply all pending migrations including:

- `supabase/migrations/020_phase3_api_cache_email_marks.sql`

### Build verification

Run:

- `npm run lint`
- `npm run build`

Expected: both pass.

---

## 1) Feature validation: Games section

File area:

- `src/components/sections/Phase3PlaygroundSection.tsx`
- `src/app/page.tsx`
- `src/components/shared/SiteNav.tsx`

### 1A. Section renders and nav works

Steps:

1. Start app: `npm run dev`
2. Open home page.
3. Click `Playground` in top navigation.

Expected:

- Page scrolls to `#playground`.
- Section title `Playground` is visible.
- Section appears between `Timezones` and `Ideas`.

### 1B. Lichess puzzle embeds (side by side)

Steps:

1. In `Playground`, verify two Lichess puzzle iframes load (mate in 2 and mate in 3).
2. Optional: set `NEXT_PUBLIC_LICHESS_PUZZLE_MATE2` / `NEXT_PUBLIC_LICHESS_PUZZLE_MATE3` to other puzzle IDs and reload.

Expected:

- Both boards are visible and interactive inside the embed.
- Each column has a link “Open full puzzle on Lichess (new tab)” that works.

### 1C. WhoFits — description + new tab only

Case A: `NEXT_PUBLIC_WHOFITS_URL` set

1. Set URL in env.
2. Reload app.
3. Open `Playground`.

Expected:

- WhoFits is **not** embedded on the page.
- The full URL is shown as plain text (break-all).
- “Open WhoFits in a new tab” opens the game in a separate tab/window.

Case B: `NEXT_PUBLIC_WHOFITS_URL` not set

1. Remove/comment the env var.
2. Reload app.

Expected:

- Friendly message appears explaining to set `NEXT_PUBLIC_WHOFITS_URL` (no iframe).

---

## 2) Feature validation: Weather

File area:

- `src/app/api/weather/route.ts`
- `src/components/sections/Phase3PlaygroundSection.tsx`

### 2A. API happy path

Steps:

1. Ensure `OPENWEATHER_API_KEY` is set.
2. Call endpoint in browser:
   - `http://localhost:3000/api/weather`

Expected JSON shape:

- `ok: true`
- `locationLabel` (string)
- `tempC` (number)
- `feelsLikeC` (number)
- `description` (string)
- `iconCode` (string)
- `cached` (boolean)

### 2B. API missing key behavior

Steps:

1. Remove `OPENWEATHER_API_KEY`.
2. Call `/api/weather`.

Expected:

- `ok: false`
- `missingApiKey: true`
- readable message
- HTTP 200 (graceful response), not crash

### 2C. Widget rendering

Steps:

1. Restore weather API key.
2. Open home page `Playground`.
3. Observe weather card.
4. Click `Refresh`.

Expected:

- Temperature and description render.
- OpenWeather icon renders.
- Refresh reloads data without UI error.

---

## 3) Feature validation: Cricket

File area:

- `src/app/api/cricket/route.ts`
- `src/components/sections/Phase3PlaygroundSection.tsx`

### 3A. API happy path

Steps:

1. Set one cricket key (`CRICKET_API_KEY` preferred).
2. Call:
   - `http://localhost:3000/api/cricket`

Expected:

- `ok: true`
- `matches` array (may be empty if provider has no current data)
- each match item includes:
  - `id`
  - `name`
  - `status`
  - optional `team1`, `team2`, `matchType`

### 3B. API missing key behavior

Steps:

1. Remove all cricket keys.
2. Call `/api/cricket`.

Expected:

- `ok: false`
- `missingApiKey: true`
- readable message

### 3C. Widget rendering

Steps:

1. Restore cricket key.
2. Open `Playground`.
3. Check cricket card list.
4. Click `Refresh`.

Expected:

- Either match cards render, or a clean "No current matches" state.
- No unhandled errors in UI.

---

## 4) Feature validation: Automated emails and cron

File area:

- `src/app/api/cron/digests/route.ts`
- `src/lib/digestCronEmail.ts`
- `src/lib/cronAuth.ts`
- `vercel.json`

## 4A. Authorization works

Steps:

1. Call without secret:
   - `GET /api/cron/digests`
2. Call with secret:
   - header `Authorization: Bearer <CRON_SECRET>`
   - or query `?secret=<CRON_SECRET>`

Expected:

- Without secret: `401 Unauthorized`
- With secret: `200` + JSON summary

### 4B. Birthday email flow

Precondition:

- At least one `profiles` row with:
  - valid `email`
  - `birthday_month` and `birthday_day` matching current IST date

Steps:

1. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
2. Trigger route with cron secret.

Expected:

- JSON summary shows birthday candidate/sent counts.
- Row inserted in `email_logs` with:
  - `event_type = 'birthday'`
  - `status = 'sent'` (or `failed` if provider rejects)
- Row inserted in `email_send_marks` for dedupe.

### 4C. Weekly digest flow

Behavior note:

- Weekly sends only when IST weekday is Sunday.

Validation options:

Option 1 (real schedule):

1. Trigger on Sunday IST.
2. Inspect summary and logs.

Option 2 (temporary test tweak in dev only):

1. Temporarily force `runWeekly = true` in local branch.
2. Trigger route once.
3. Revert test tweak.

Expected:

- One digest attempt per profile with email.
- `email_logs` rows with `event_type = 'weekly_digest'`.
- `email_send_marks` created with `period_key` like `YYYY-Wnn`.

### 4D. Dedupe validation

Steps:

1. Trigger `/api/cron/digests` twice with same day/week conditions.
2. Compare first and second response summaries.

Expected:

- Second run should increase `skipped` count.
- Duplicate sends should not happen for same:
  - birthday year marker
  - weekly period key

### 4E. Vercel cron schedule validation

File check:

- `vercel.json` includes:
  - `/api/cron/purge-expired-posts`
  - `/api/cron/digests` with schedule `30 2 * * *`

Post-deploy check:

1. Open Vercel project cron/job logs.
2. Verify digest endpoint is invoked daily.

Expected:

- Cron executions visible in logs.
- Route returns JSON summary without auth error.

---

## 5) Feature validation: DB-backed API cache

File area:

- `src/lib/apiResponseCache.ts`
- `src/app/api/weather/route.ts`
- `src/app/api/cricket/route.ts`
- table `api_response_cache`

### 5A. Cache write/read for weather

Steps:

1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set.
2. Call `/api/weather` twice within 15 minutes.
3. Inspect responses.

Expected:

- First call: usually `cached: false`
- Second call: `cached: true`
- `api_response_cache` has key `weather:<query>`

### 5B. Cache write/read for cricket

Steps:

1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set.
2. Call `/api/cricket` twice within 10 minutes.

Expected:

- Second response is from cache (`cached: true`)
- `api_response_cache` has key `cricket:currentMatches`

### 5C. No-service-role graceful behavior

Steps:

1. Remove `SUPABASE_SERVICE_ROLE_KEY`.
2. Call weather/cricket endpoints.

Expected:

- APIs still work with live provider calls.
- No crash from missing service client.

---

## 6) Pass/fail checklist (quick)

- [ ] Playground section visible and nav linked
- [ ] Lichess iframe renders
- [ ] WhoFits embed/message behavior correct
- [ ] `/api/weather` handles both configured and missing-key states
- [ ] Weather card refresh works
- [ ] `/api/cricket` handles both configured and missing-key states
- [ ] Cricket card renders list/empty state cleanly
- [ ] `/api/cron/digests` requires cron secret
- [ ] Birthday email path creates `email_logs` + `email_send_marks`
- [ ] Weekly digest path works on Sunday IST (or forced dev test)
- [ ] Dedupe confirmed by second trigger
- [ ] API cache works when service role key is present
- [ ] Lint/build pass after validation changes

---

## 7) Useful test commands

Example local checks:

- Weather:
  - `GET http://localhost:3000/api/weather`
- Cricket:
  - `GET http://localhost:3000/api/cricket`
- Digests (authorized):
  - `GET http://localhost:3000/api/cron/digests?secret=<CRON_SECRET>`

If needed, I can also create a shorter "QA sign-off" version of this doc with only pass/fail rows and evidence columns.
