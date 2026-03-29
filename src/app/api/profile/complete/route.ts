import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const currentYear = new Date().getFullYear();

const bodySchema = z.object({
  masterFriendId: z.string().uuid(),
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  nickname: z.string().min(1).max(80).trim(),
  phone: z.string().max(32).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  bio: z.string().max(120).optional().nullable(),
  birthdayMonth: z.number().int().min(1).max(12),
  birthdayDay: z.number().int().min(1).max(31),
  birthdayYear: z.number().int().min(1900).max(currentYear + 1),
});

function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
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
    masterFriendId,
    firstName,
    lastName,
    nickname,
    phone,
    city,
    bio,
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

  const { error } = await supabase.rpc("complete_registration", {
    p_master_friend_id: masterFriendId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_nickname: nickname,
    p_phone: phone ?? null,
    p_city: city ?? null,
    p_bio: bio ?? null,
    p_birthday_month: birthdayMonth,
    p_birthday_day: birthdayDay,
    p_birthday_year: birthdayYear,
  });

  if (error) {
    logger.error("api/profile/complete", "RPC failed", {
      message: error.message,
      code: error.code,
    });
    const map: Record<string, string> = {
      NOT_AUTHENTICATED: "Unauthorized",
      PROFILE_EXISTS: "Profile already completed",
      NO_EMAIL: "Account email missing",
      INVALID_BUDDY: "Invalid buddy selection",
      ALREADY_REGISTERED: "That name is already taken",
      INVALID_BIRTHDAY: "Invalid birthday",
      INVALID_NAME: "First name, last name, and nickname are required",
    };
    const msg = map[error.message] ?? "Could not complete registration";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
