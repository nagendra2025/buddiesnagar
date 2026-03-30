# BuddyNagar

Private SPA for the Kadapa Buddies — **Phase 1** covers registration, profiles, spotlight, fun facts, and news. **Phase 2** adds cinema posts, poetry wall, memory lane (gallery with approval), and suggestions with votes.

**What’s shipped vs planned:** see [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) (includes full migration list through `016` and Phase 3–4 backlog).

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase keys (and optional `NEWS_API_KEY`). For gallery admin email alerts, add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `GALLERY_NOTIFY_EMAIL`.
2. In the Supabase SQL editor, run **all** migrations in `supabase/migrations/` in numeric order (`001` … `016`) — see `docs/IMPLEMENTATION_STATUS.md` — then `supabase/seed/phase1_seed.sql`.
3. Grant roles in SQL as needed, e.g. `update public.profiles set roles = array['member','admin'] where email = 'you@example.com';` for **gallery approval** and admin-only deletes. **Cinema and poetry posting** are allowed for any member with a profile after migrations **`012`** and **`016`** (older `cinema_poster` / `poetry_poster` restrictions are removed by those policies).
4. **Auth:** In Supabase → Authentication → URL configuration, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your production URL + `/auth/callback`
   - Under **Providers → Email**, keep **Email** enabled. New members: **magic link from the wall** → open link → **finish profile** (set password + details); return visits use **Back again?** with email + password. Custom **SMTP (e.g. Resend)** is configured under Authentication → Emails, not only Third-Party Auth.
5. Set **`CRON_SECRET`** in `.env.local` (long random string). Vercel Cron (see `vercel.json`, hourly) calls `/api/cron/purge-expired-posts` with `Authorization: Bearer <CRON_SECRET>` to delete cinema, poetry, and gallery posts **older than 100 hours** and remove their Storage files. Locally you can trigger the same cleanup with:
   `curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/purge-expired-posts"`
6. `npm install` then `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Stack

Next.js (App Router), TypeScript (strict), Tailwind CSS v4, shadcn-style UI (Radix), Supabase Auth + Postgres + Realtime.

## Phase 2 notes

- **Cinema & poetry posts:** Any signed-in user **with a `profiles` row** can post after migrations **`012`** (cinema) and **`016`** (poetry). See `docs/IMPLEMENTATION_STATUS.md`.
- **Gallery approval:** After `003` + `004`, new memories upload to a **private** bucket via `POST /api/gallery/submit`; the public grid only shows photos after an **Approve** (copies file to the public bucket). A **Resend** email goes to `GALLERY_NOTIFY_EMAIL` on submit (Memory lane only).
- **100-hour rotation:** Cinema (`published_at`), poetry (`posted_at`), and gallery (`uploaded_at`) entries older than **100 hours** are hidden on the home page and removed from Postgres + Storage by the cron route (requires `CRON_SECRET` + Vercel Cron or manual `curl`).
