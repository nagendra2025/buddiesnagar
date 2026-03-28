# BuddyNagar

Private SPA for the Kadapa Buddies — **Phase 1** covers registration, profiles, spotlight, fun facts, and news. **Phase 2** adds cinema posts, poetry wall, memory lane (gallery with approval), and suggestions with votes.

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase keys (and optional `NEWS_API_KEY`). For gallery admin email alerts, add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `GALLERY_NOTIFY_EMAIL`.
2. In the Supabase SQL editor, run migrations in order: `001_phase1_schema.sql`, `002_phase2_schema.sql`, `003_gallery_admin_rls.sql`, `004_gallery_pending_private_storage.sql`, `005_master_friends_display_names.sql`, `006_master_friend_nagendra_name.sql`, `007_nagendrakumar_adapala_names.sql`, `008_content_delete_admin_only.sql`, then `supabase/seed/phase1_seed.sql`.
3. Grant roles in SQL as needed, e.g. `update public.profiles set roles = array['member','admin'] where email = 'you@example.com';` and `cinema_poster` for cinema-only posters. (`poetry_poster` is unused for the post button — any signed-in user can post poetry.)
4. **Auth:** In Supabase → Authentication → URL configuration, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your production URL + `/auth/callback`
   - Under **Providers → Email**, keep **Email** enabled (passwords are used for sign-up and “Back again?” login). If **Confirm email** is on, new members must click the confirmation email once before they can log in with email + password; turning confirmation off speeds local testing but weakens verification—choose per environment.
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

- **Cinema posts:** Only profiles whose `roles` include `admin` or `cinema_poster` see the post button. **Poetry:** any signed-in user can post.
- **Gallery approval:** After `003` + `004`, new memories upload to a **private** bucket via `POST /api/gallery/submit`; the public grid only shows photos after an **Approve** (copies file to the public bucket). A **Resend** email goes to `GALLERY_NOTIFY_EMAIL` on submit (Memory lane only). Cinema and poetry are unchanged.
- **100-hour rotation:** Cinema (`published_at`), poetry (`posted_at`), and gallery (`uploaded_at`) entries older than **100 hours** are hidden on the home page and removed from Postgres + Storage by the cron route (requires `CRON_SECRET` + Vercel Cron or manual `curl`).
