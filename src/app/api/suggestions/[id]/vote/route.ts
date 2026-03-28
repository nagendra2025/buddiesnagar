import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.rpc("vote_suggestion", {
    p_suggestion_id: id,
  });

  if (error) {
    logger.error("api/suggestions/vote", "rpc failed", { message: error.message });
    return NextResponse.json({ error: "Could not record vote" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
