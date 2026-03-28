import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  emoji: z.string().min(1).max(8),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const emoji = parsed.data.emoji.trim().slice(0, 8);
  if (!emoji) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: readError } = await supabase
    .from("fun_facts")
    .select("reactions")
    .eq("id", id)
    .maybeSingle();

  if (readError || !row) {
    logger.warn("api/fun-facts/react", "read failed", { message: readError?.message });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reactions = {
    ...(typeof row.reactions === "object" && row.reactions !== null
      ? (row.reactions as Record<string, string>)
      : {}),
    [user.id]: emoji,
  };

  const { error: updError } = await supabase
    .from("fun_facts")
    .update({ reactions })
    .eq("id", id);

  if (updError) {
    logger.error("api/fun-facts/react", "update failed", { message: updError.message });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reactions });
}
