import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  /** After email link, land on home and scroll to the profile completion card. */
  const next =
    nextParam === "/" || nextParam === "" ? "/#finish-profile" : nextParam;

  if (!code) {
    return NextResponse.redirect(`${url.origin}/?auth=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.error("auth/callback", "exchangeCodeForSession failed", {
      message: error.message,
    });
    return NextResponse.redirect(`${url.origin}/?auth=error`);
  }

  const path = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(new URL(path, url.origin).toString());
}
