# BuddyNagar (Kadapa Buddies) — Final PRD v2.1

## 1. Product overview

BuddyNagar is a private, invite-only web application designed for a small group of trusted friends to act as a shared memory hub, planning board, and celebration platform.

## 2. Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase |
| Hosting | Vercel |
| Email | Resend |

## 3. Architecture

Single Page Application with scrollable sections.

## 4. MVP delivery plan

| Phase | Scope |
| --- | --- |
| **Phase 1** | Registration, Profiles, Spotlight, Fun Facts, News |
| **Phase 2** | Cinema, Poetry, Gallery, Suggestions |
| **Phase 3** | Games, Weather, Emails |
| **Phase 4** | Launch & hardening: production deploy (Vercel), env + secrets, Supabase auth URLs, RLS review, Vercel Cron wiring, observability/logging pass, accessibility & performance smoke test, domain/DNS, backup/rollback sanity check |

**Phase 4** is the **go-live** slice: everything needed to run BuddyNagar safely in production after Phases 1–3 are feature-complete—not a new feature phase.

## 5. Database tables

- `profiles` (with `roles[]`)
- `master_friends`
- `wishes`
- `fun_facts`
- `news_articles_cache`
- `cinema_news`
- `poetry_wall`
- `photo_gallery`
- `suggestions`
- `suggestion_votes`
- `email_logs`

## 6. Role system

- `member`
- `admin`
- `cinema_poster`
- `poetry_poster`

## 7. Job execution

Use **Vercel Cron only**.

## 8. Email system

**Triggers:** Registration, Birthday, Weekly

## 9. Edge cases

- Feb 29 handling
- Duplicate email prevention
- JSON safety

## 10. Acceptance criteria

- Real-time updates
- Approval flows
- API fallback

## 11. Security

Supabase Auth + RLS

## 12. Success metrics

- Weekly usage
- Reduced WhatsApp noise

---

## Final vision

Private digital clubhouse for friends.
