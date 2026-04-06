import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const currentYear = new Date().getFullYear();
const ALLOWED_TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Detroit",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
] as const;

const bodySchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  nickname: z.string().min(1).max(80).trim(),
  phone: z.string().min(1).max(32).trim(),
  city: z.string().min(1).max(120).trim(),
  bio: z.string().min(1).max(120).trim(),
  timezone: z.enum(ALLOWED_TIMEZONES),
  birthdayMonth: z.number().int().min(1).max(12),
  birthdayDay: z.number().int().min(1).max(31),
  birthdayYear: z.number().int().min(1900).max(currentYear + 1),
});

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    nickname,
    phone,
    city,
    bio,
    timezone,
    birthdayMonth,
    birthdayDay,
    birthdayYear,
  } = parsed.data;

  if (!isValidCalendarDate(birthdayYear, birthdayMonth, birthdayDay)) {
    return NextResponse.json({ error: "Invalid birthday" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      nickname,
      phone,
      city,
      bio,
      timezone,
      birthday_month: birthdayMonth,
      birthday_day: birthdayDay,
      birthday_year: birthdayYear,
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    logger.error("api/profile/update", "update failed", {
      message: error.message,
      code: error.code,
    });
    const low = (error.message ?? "").toLowerCase();
    if (low.includes("timezone") || low.includes("column")) {
      return NextResponse.json(
        { error: "Profile schema is outdated. Run migration 019_profiles_timezone.sql." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not update profile" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: updated });
}

