# BuddyNagar — implementation status (for continued development)

**Last aligned with repo:** March 2026. Use this doc to see **what is shipped** (including your current Vercel + Supabase deployment) versus **what the PRD still expects** in later phases.

PRD reference: `PRD/BuddyNagar_Final_PRD.md`. Deeper build narrative: `docs/phasewise.md`.

---

## Summary

| Phase | PRD scope | Status |
| --- | --- | --- |
| **1** | Registration, profiles, spotlight, fun facts, news | **Done** (with auth/profile refinements below) |
| **2** | Cinema, poetry, gallery, suggestions | **Done** (with RLS/policy updates below) |
| **3** | Games, weather, emails (automated) | **Not started** |
| **4** | Launch & hardening | **Partial** — you are deployed; full hardening checklist remains |

---

## Phase 1 — implemented

### Product behaviour

- **Registration:** Names on the wall → **email only** (magic link) → user opens link → **one “Finish profile” form** (password + confirm + name, nickname, birthday, optional fields) → `complete_registration` RPC. **Back again?** = email + password for return visits.
- **Profiles:** `profiles` row + `master_friends` claim via RPC; Realtime on `profiles` for “Who joined”.
- **Spotlight:** Buddy birthdays from `birthday_month` / `birthday_day`; festival/special wishes from `wishes` (`is_recurring` = month/day only; year in DB is a placeholder).
- **Fun facts:** Daily pick = **day-of-year** round-robin over facts ordered by `created_at` (see `pickTodayFact` in `src/app/page.tsx`). **100+ facts** in migration `013_fun_facts_expand.sql` (plus seed defaults).
- **News:** `/api/news` with `news_articles_cache`; category filters on the home page.

### Main code / data

- **Migrations:** `001`, `005`–`011`, `010` (profile names RPC), `013` (fun facts bulk), `015` (e.g. Nagaraj on wall — extend as needed).
- **Seed:** `supabase/seed/phase1_seed.sql` (master friends, sample facts/wishes).
- **APIs:** `/api/profile/complete`, `/api/news`, `/api/fun-facts/[id]/react`, `/auth/callback` (redirects to `/#finish-profile` after email link).

---

## Phase 2 — implemented

### Product behaviour

- **Cinema buzz:** Post with title (+ optional image, notes, industry). **Any signed-in member with a profile** may post (`canPostCinema` + RLS migration `012`).
- **Poets corner:** Image upload + optional caption/poet/language. **Any signed-in member with a profile** may post (RLS migration `016`; older DBs may still have admin/poetry_poster-only policy until `016` is applied).
- **Memory lane:** Submit via `POST /api/gallery/submit` → private pending storage → admin **Approve** promotes to public gallery; Resend notify optional. Likes via RPC.
- **Ideas / suggestions:** Submit + upvote; list shows author (profile embed), status, **vote count** on button (`Voted · N` / `Upvote · N`). Client state syncs from server after `router.refresh()`; public read policy reinforced in `014`.

### Content TTL

- Cinema, poetry, and **approved** gallery items **older than 100 hours** are hidden on the home query and removed by **`/api/cron/purge-expired-posts`** (Vercel Cron + `CRON_SECRET`).

### Main code / data

- **Migrations:** `002`, `003`, `004`, `008`, **`012`** (cinema insert for all members), **`014`** (suggestions `SELECT` for `public`), **`016`** (poetry insert for all members).
- **APIs:** `/api/suggestions`, `/api/suggestions/[id]/vote`, `/api/cinema/[id]/like`, `/api/poetry/[id]/like`, `/api/gallery/submit`, `/api/gallery/[id]/like`, `/api/gallery/[id]/approve`, `/api/cron/purge-expired-posts`.

### Role notes (vs older README lines)

- **`cinema_poster` / `poetry_poster`:** No longer required for posting in the app **after** migrations **`012`** and **`016`** are applied. **`admin`** still used for gallery approval, admin-only deletes (`008`), etc.

---

## Supabase migrations — recommended order (full current set)

Run in numeric order on any new environment:

1. `001_phase1_schema.sql`  
2. `002_phase2_schema.sql`  
3. `003_gallery_admin_rls.sql`  
4. `004_gallery_pending_private_storage.sql`  
5. `005_master_friends_display_names.sql`  
6. `006_master_friend_nagendra_name.sql`  
7. `007_nagendrakumar_adapala_names.sql`  
8. `008_content_delete_admin_only.sql`  
9. `009_master_friend_nagendrakumar_a.sql`  
10. `010_profile_names_nickname_birthyear.sql`  
11. `011_indian_festivals_wishes.sql`  
12. `012_cinema_insert_any_member.sql`  
13. `013_fun_facts_expand.sql`  
14. `014_suggestions_select_public.sql`  
15. `015_master_friend_nagaraj.sql`  
16. `016_poetry_insert_any_member.sql`  

Then seed: `supabase/seed/phase1_seed.sql` (idempotent).

---

## Phase 3 — not implemented (next development chunk)

Per PRD §4 / `phasewise.md`:

| Area | Description | Notes |
| --- | --- | --- |
| **Games** | e.g. WhoFits iframe, optional Lichess / chess leaderboard | PRD + `phasewise.md` sketch |
| **Weather** | e.g. `GET /api/weather`, OpenWeather or similar | Env + cache pattern like news |
| **Cricket live/scores** | Dedicated API + caching (News section already has a Cricket category for headlines) | Optional separate from news cache |
| **Emails** | Registration/birthday/weekly triggers, templates, `email_logs` usage | Resend; align with PRD §8; Vercel Cron |

Nothing in `src/app` is committed yet as a dedicated “Phase 3” section set; `email_logs` exists from Phase 1 stub.

---

## Phase 4 — partial (hardening; not a feature phase)

**Likely already true for you:** Vercel deploy, production Supabase, auth redirect URLs, SMTP/Resend for auth email, cron for purge.

**Still worth doing / verifying:**

- Full **RLS + Storage policy** review (especially after adding migrations 012–016).
- **Secrets** parity: `.env.example` ↔ Vercel ↔ Supabase.
- **Domain / DNS**, **backups**, **monitoring** (Supabase + Vercel logs).
- **Accessibility & performance** pass on the SPA.
- **Smoke tests:** magic link → profile completion → post cinema/poetry → suggestion vote → gallery submit → admin approve.

---

## Quick “where is it?” index

| Feature | Primary UI | Primary API / DB |
| --- | --- | --- |
| Auth + join | `HeroRegistration`, `ProfileCompletionForm` | Supabase Auth, `complete_registration` |
| Gang list | `ProfilesSection` | `profiles` |
| Spotlight | `SpotlightSection` | `profiles`, `wishes` |
| Fun fact | `FunFactSection` | `fun_facts`, `/api/fun-facts/...` |
| News | `NewsSection` | `/api/news`, `news_articles_cache` |
| Cinema | `CinemaNewsSection` | `cinema_news`, Storage `buddynagar-cinema` |
| Poetry | `PoetryWallSection` | `poetry_wall`, `buddynagar-poetry` |
| Memories | `MemoryLaneSection` | `photo_gallery`, gallery APIs, pending bucket |
| Ideas | `SuggestionsSection` | `suggestions`, `suggestion_votes` |

---

## Maintaining this document

When you ship Phase 3 (or change RLS/posting rules again):

1. Update the **Summary** table and the relevant phase section.  
2. Append new migrations to the **recommended order** list.  
3. Optionally sync bullets in `README.md` if behaviour diverges (auth, roles, migration list).
