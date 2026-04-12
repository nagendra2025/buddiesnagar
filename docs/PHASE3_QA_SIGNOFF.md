# Phase 3 QA Sign-off

Use this sheet for quick validation tracking and final sign-off.

Reference detailed guide:

- `docs/PHASE3_VALIDATION.md`

---

## Test metadata

- Tester:
- Date:
- Environment: Local / Vercel Preview / Vercel Production
- Branch / Commit:

---

## Sign-off table

Status values: `PASS` / `FAIL` / `BLOCKED` / `N/A`

| ID | Feature | Test | Status | Evidence (URL/screenshot/log) | Notes |
| --- | --- | --- | --- | --- | --- |
| G-1 | Games | `Playground` nav link scrolls to section |  |  |  |
| G-2 | Games | Two Lichess puzzle iframes render (mate 2 + mate 3) |  |  |  |
| G-3 | Games | WhoFits shows URL + opens in new tab when env URL is set |  |  |  |
| G-4 | Games | WhoFits fallback message when URL not set (no iframe) |  |  |  |
| W-1 | Weather API | `/api/weather` returns `ok: true` with valid key |  |  |  |
| W-2 | Weather API | `/api/weather` returns graceful missing-key response |  |  |  |
| W-3 | Weather UI | Weather card renders temp/desc/icon |  |  |  |
| W-4 | Weather UI | `Refresh` button reloads data |  |  |  |
| C-1 | Cricket API | `/api/cricket` returns `ok: true` with valid key |  |  |  |
| C-2 | Cricket API | `/api/cricket` returns graceful missing-key response |  |  |  |
| C-3 | Cricket UI | Cricket card renders matches or clean empty state |  |  |  |
| C-4 | Cricket UI | `Refresh` button reloads data |  |  |  |
| E-1 | Cron auth | `/api/cron/digests` without secret returns `401` |  |  |  |
| E-2 | Birthday email | Authorized trigger sends birthday email for IST-matching profile |  |  |  |
| E-3 | Birthday logging | `email_logs` row added with `event_type='birthday'` |  |  |  |
| E-4 | Birthday dedupe | Second trigger skips duplicate send |  |  |  |
| E-5 | Weekly digest | Sunday IST run sends weekly digest |  |  |  |
| E-6 | Weekly logging | `email_logs` row added with `event_type='weekly_digest'` |  |  |  |
| E-7 | Weekly dedupe | Same-week second trigger skips duplicate send |  |  |  |
| E-8 | Send marks | `email_send_marks` contains expected period markers |  |  |  |
| K-1 | Weather cache | Second `/api/weather` call within TTL returns cached result |  |  |  |
| K-2 | Cricket cache | Second `/api/cricket` call within TTL returns cached result |  |  |  |
| K-3 | Cache table | `api_response_cache` has weather/cricket keys |  |  |  |
| B-1 | Build health | `npm run lint` passes |  |  |  |
| B-2 | Build health | `npm run build` passes |  |  |  |

---

## Defects log

| Defect ID | Severity (S1/S2/S3) | Summary | Steps to reproduce | Owner | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

---

## Final decision

- Phase 3 QA result: `APPROVED` / `APPROVED WITH RISKS` / `REJECTED`
- Approved by:
- Approval date:
- Risks accepted:
- Follow-up action items:

