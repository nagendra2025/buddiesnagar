/**
 * Maps Supabase Auth email errors to actionable copy (OTP / magic link / confirm).
 * Still logs full message server-side via logger at call sites.
 */
export function userFacingAuthEmailError(raw: string | undefined): string {
  const m = (raw ?? "").toLowerCase();
  if (!m) {
    return "Could not send the email. Check Supabase Dashboard → Logs → Auth for details.";
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("email rate")) {
    return "Too many emails were sent recently. Wait several minutes, then try again.";
  }
  if (
    m.includes("redirect") ||
    m.includes("redirect_uri") ||
    m.includes("url configuration")
  ) {
    return "Redirect URL blocked: in Supabase go to Authentication → URL Configuration and add this site’s URL and https://…/auth/callback.";
  }
  if (
    m.includes("smtp") ||
    m.includes("mailer") ||
    m.includes("sending") ||
    m.includes("ses") ||
    m.includes("resend")
  ) {
    return "SMTP / mail delivery failed. Open Supabase → Authentication → Emails (SMTP): verify Resend host, API key, and that your “from” domain is verified in Resend.";
  }
  if (m.includes("sign up") && m.includes("not allowed")) {
    return "Email sign-ups are disabled in this Supabase project. Enable the Email provider under Authentication → Providers.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "That email address was rejected. Check for typos.";
  }
  const trimmed = (raw ?? "").trim();
  if (trimmed.length > 0 && trimmed.length <= 220) {
    return trimmed;
  }
  return "Could not send the email. Check Supabase Dashboard → Logs → Auth and SMTP settings.";
}
