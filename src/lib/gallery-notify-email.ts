import { Resend } from "resend";
import { logger } from "@/lib/logger";

export type GalleryPendingPayload = {
  photoId: string;
  imageUrl: string;
  caption: string | null;
  yearApprox: string | null;
  uploaderName: string | null;
};

function appOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function sendGalleryPendingNotification(
  payload: GalleryPendingPayload,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.GALLERY_NOTIFY_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !to || !from) {
    logger.error("gallery-notify-email", "missing env", {
      hasKey: Boolean(apiKey),
      hasTo: Boolean(to),
      hasFrom: Boolean(from),
    });
    return { sent: false, error: "Email not configured" };
  }

  const origin = appOrigin();
  const memoriesUrl = `${origin}/#memories`;
  const cap = payload.caption?.trim() || "(no caption)";
  const year = payload.yearApprox?.trim() || "—";
  const who = payload.uploaderName?.trim() || "A buddy";

  const html = `
    <p>New memory photo is waiting for your approval on BuddyNagar.</p>
    <ul>
      <li><strong>From:</strong> ${escapeHtml(who)}</li>
      <li><strong>Caption:</strong> ${escapeHtml(cap)}</li>
      <li><strong>Year / note:</strong> ${escapeHtml(year)}</li>
      <li><strong>Photo ID:</strong> ${escapeHtml(payload.photoId)}</li>
    </ul>
    <p><a href="${memoriesUrl}">Open Memory lane</a> while signed in as admin, then tap <strong>Approve</strong> on the pending card.</p>
    ${
      payload.imageUrl.trim()
        ? `<p><img src="${escapeAttr(payload.imageUrl)}" alt="Pending memory" width="600" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
        : "<p><em>Preview image link unavailable — open BuddyNagar to review.</em></p>"
    }
  `;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "[BuddyNagar] New memory pending approval",
      html,
    });
    if (error) {
      logger.error("gallery-notify-email", "resend error", { message: error.message });
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("gallery-notify-email", "send failed", { message });
    return { sent: false, error: message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
