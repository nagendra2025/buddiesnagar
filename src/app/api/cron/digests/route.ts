import { NextResponse } from "next/server";
import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";
import { createServiceClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cronAuth";
import { logger } from "@/lib/logger";
import {
  sendBirthdayEmail,
  sendWeeklyDigestEmail,
  type WeeklyStats,
} from "@/lib/digestCronEmail";

export const dynamic = "force-dynamic";

function istCalendarParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

function istWeekdayShort(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(d);
}

function isoWeekPeriodKey(d: Date): string {
  const { year, month, day } = istCalendarParts(d);
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const wkYear = getISOWeekYear(parseISO(ymd));
  const wk = getISOWeek(parseISO(ymd));
  return `${wkYear}-W${String(wk).padStart(2, "0")}`;
}

async function weeklyStats(svc: NonNullable<ReturnType<typeof createServiceClient>>): Promise<WeeklyStats> {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [cRes, pRes, gRes, sRes] = await Promise.all([
    svc
      .from("cinema_news")
      .select("*", { count: "exact", head: true })
      .gte("published_at", sinceIso)
      .eq("is_published", true),
    svc
      .from("poetry_wall")
      .select("*", { count: "exact", head: true })
      .gte("posted_at", sinceIso)
      .eq("is_published", true),
    svc
      .from("photo_gallery")
      .select("*", { count: "exact", head: true })
      .gte("uploaded_at", sinceIso)
      .eq("is_approved", true),
    svc
      .from("suggestions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceIso),
  ]);

  const n = (label: string, res: { count: number | null; error: { message: string } | null }) => {
    if (res.error) {
      logger.warn("api/cron/digests", "count failed", { label, message: res.error.message });
      return 0;
    }
    return res.count ?? 0;
  };

  return {
    cinema: n("cinema", cRes),
    poetry: n("poetry", pRes),
    gallery: n("gallery", gRes),
    suggestions: n("suggestions", sRes),
  };
}

async function alreadySent(
  svc: NonNullable<ReturnType<typeof createServiceClient>>,
  profileId: string,
  eventType: string,
  periodKey: string,
): Promise<boolean> {
  const { data, error } = await svc
    .from("email_send_marks")
    .select("id")
    .eq("profile_id", profileId)
    .eq("event_type", eventType)
    .eq("period_key", periodKey)
    .maybeSingle();
  if (error) {
    logger.warn("api/cron/digests", "send_marks lookup failed", { message: error.message });
    return true;
  }
  return Boolean(data);
}

async function recordMark(
  svc: NonNullable<ReturnType<typeof createServiceClient>>,
  profileId: string,
  eventType: string,
  periodKey: string,
): Promise<void> {
  const { error } = await svc.from("email_send_marks").insert({
    profile_id: profileId,
    event_type: eventType,
    period_key: periodKey,
  });
  if (error) {
    logger.error("api/cron/digests", "send_marks insert failed", {
      message: error.message,
      profileId,
      eventType,
    });
  }
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "Service client unavailable" }, { status: 503 });
  }

  const now = new Date();
  const { year, month, day } = istCalendarParts(now);
  const runWeekly = istWeekdayShort(now) === "Sun";
  const weekKey = isoWeekPeriodKey(now);
  const birthdayYearMark = String(year);

  const resendReady = Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim(),
  );

  const summary = {
    resendConfigured: resendReady,
    birthdays: { candidates: 0, sent: 0, skipped: 0 },
    weekly: { ran: runWeekly, candidates: 0, sent: 0, skipped: 0 },
  };

  const { data: birthdayRows, error: bErr } = await svc
    .from("profiles")
    .select("id, email, full_name, nickname, birthday_month, birthday_day")
    .eq("birthday_month", month)
    .eq("birthday_day", day);

  if (bErr) {
    logger.error("api/cron/digests", "birthday query failed", { message: bErr.message });
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  if (!resendReady) {
    summary.birthdays.skipped = birthdayRows?.length ?? 0;
  } else {
    for (const row of birthdayRows ?? []) {
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!email) continue;
      summary.birthdays.candidates += 1;

      if (await alreadySent(svc, row.id, "birthday", birthdayYearMark)) {
        summary.birthdays.skipped += 1;
        continue;
      }

      const display =
        (typeof row.nickname === "string" && row.nickname.trim()) ||
        (typeof row.full_name === "string" && row.full_name.trim()) ||
        "Buddy";
      const ok = await sendBirthdayEmail(svc, email, display, row.id, birthdayYearMark);
      if (ok) {
        await recordMark(svc, row.id, "birthday", birthdayYearMark);
        summary.birthdays.sent += 1;
      }
    }
  }

  if (runWeekly) {
    const stats = await weeklyStats(svc);
    const { data: allProfiles, error: pErr } = await svc
      .from("profiles")
      .select("id, email, full_name, nickname");

    if (pErr) {
      logger.error("api/cron/digests", "profiles query failed", { message: pErr.message });
    } else {
      for (const row of allProfiles ?? []) {
        const email = typeof row.email === "string" ? row.email.trim() : "";
        if (!email) continue;
        summary.weekly.candidates += 1;

        if (await alreadySent(svc, row.id, "weekly_digest", weekKey)) {
          summary.weekly.skipped += 1;
          continue;
        }

        const display =
          (typeof row.nickname === "string" && row.nickname.trim()) ||
          (typeof row.full_name === "string" && row.full_name.trim()) ||
          "Buddy";
        const ok = await sendWeeklyDigestEmail(svc, email, display, row.id, weekKey, stats);
        if (ok) {
          await recordMark(svc, row.id, "weekly_digest", weekKey);
          summary.weekly.sent += 1;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, summary, ist: { year, month, day }, weekKey });
}

export async function POST(request: Request) {
  return GET(request);
}
