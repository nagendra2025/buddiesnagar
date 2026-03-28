import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  masterFriendId: z.string().uuid(),
  fullName: z.string().min(1).max(120),
  phone: z.string().max(32).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  bio: z.string().max(120).optional().nullable(),
  birthdayMonth: z.number().int().min(1).max(12).optional().nullable(),
  birthdayDay: z.number().int().min(1).max(31).optional().nullable(),
});

function validateCalendar(month: number | null | undefined, day: number | null | undefined) {
  if (month == null || day == null) return true;
  const mdays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= mdays[month - 1]!;
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
    fullName,
    phone,
    city,
    bio,
    birthdayMonth,
    birthdayDay,
  } = parsed.data;

  if (!validateCalendar(birthdayMonth ?? null, birthdayDay ?? null)) {
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
    p_full_name: fullName,
    p_phone: phone ?? null,
    p_city: city ?? null,
    p_bio: bio ?? null,
    p_birthday_month: birthdayMonth ?? null,
    p_birthday_day: birthdayDay ?? null,
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
    };
    const msg = map[error.message] ?? "Could not complete registration";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
