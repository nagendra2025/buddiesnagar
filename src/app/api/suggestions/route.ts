import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  content: z.string().trim().min(3).max(2000),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid suggestion text" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("suggestions").insert({
    user_id: user.id,
    content: parsed.data.content,
    status: "pending",
    votes: 0,
  });

  if (error) {
    logger.error("api/suggestions", "insert failed", { message: error.message });
    return NextResponse.json({ error: "Could not save suggestion" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
