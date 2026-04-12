import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

function appOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3000";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function logEmail(
  svc: SupabaseClient,
  eventType: string,
  recipient: string,
  status: string,
  payload: Record<string, unknown> | null,
): Promise<void> {
  const { error } = await svc.from("email_logs").insert({
    event_type: eventType,
    recipient,
    status,
    payload: payload ?? null,
  });
  if (error) {
    logger.error("digestCronEmail", "email_logs insert failed", {
      message: error.message,
      eventType,
    });
  }
}

export async function sendBirthdayEmail(
  svc: SupabaseClient,
  to: string,
  displayName: string,
  profileId: string,
  yearMark: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return false;
  }

  const origin = appOrigin();
  const name = escapeHtml(displayName.trim() || "Buddy");
  const html = `
    <p>Hi ${name},</p>
    <p>Happy birthday from <strong>BuddyNagar</strong> — the Kadapa buddies hope you have a wonderful day.</p>
    <p><a href="${escapeHtml(origin)}/#gang">Open Our gang</a></p>
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Happy birthday from BuddyNagar",
      html,
    });
    if (error) {
      await logEmail(svc, "birthday", to, "failed", {
        profile_id: profileId,
        message: error.message,
      });
      return false;
    }
    await logEmail(svc, "birthday", to, "sent", {
      profile_id: profileId,
      year: yearMark,
    });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEmail(svc, "birthday", to, "failed", {
      profile_id: profileId,
      message,
    });
    return false;
  }
}

export type WeeklyStats = {
  cinema: number;
  poetry: number;
  gallery: number;
  suggestions: number;
};

export async function sendWeeklyDigestEmail(
  svc: SupabaseClient,
  to: string,
  displayName: string,
  profileId: string,
  periodKey: string,
  stats: WeeklyStats,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return false;
  }

  const origin = appOrigin();
  const name = escapeHtml(displayName.trim() || "Buddy");
  const html = `
    <p>Hi ${name},</p>
    <p>Here is your weekly BuddyNagar snapshot (last 7 days):</p>
    <ul>
      <li><strong>Cinema posts:</strong> ${stats.cinema}</li>
      <li><strong>Poetry posts:</strong> ${stats.poetry}</li>
      <li><strong>Memory lane photos:</strong> ${stats.gallery}</li>
      <li><strong>New ideas:</strong> ${stats.suggestions}</li>
    </ul>
    <p><a href="${escapeHtml(origin)}/">Open BuddyNagar</a></p>
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "BuddyNagar weekly snapshot",
      html,
    });
    if (error) {
      await logEmail(svc, "weekly_digest", to, "failed", {
        profile_id: profileId,
        message: error.message,
      });
      return false;
    }
    await logEmail(svc, "weekly_digest", to, "sent", {
      profile_id: profileId,
      period: periodKey,
      stats,
    });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEmail(svc, "weekly_digest", to, "failed", {
      profile_id: profileId,
      message,
    });
    return false;
  }
}
