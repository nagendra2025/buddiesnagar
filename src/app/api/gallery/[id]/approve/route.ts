import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

function fileNameFromPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

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

  const { data: prof, error: profError } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const roles = Array.isArray(prof?.roles) ? prof.roles.map(String) : [];
  if (profError || !roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: row, error: readErr } = await svc
    .from("photo_gallery")
    .select("id, uploaded_by, image_url, pending_storage_path, is_approved")
    .eq("id", id)
    .maybeSingle();

  if (readErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.is_approved && row.image_url) {
    return NextResponse.json({ ok: true, image_url: row.image_url });
  }

  if (row.pending_storage_path) {
    const pendingPath = row.pending_storage_path;
    const { data: blob, error: dlErr } = await svc.storage
      .from("buddynagar-gallery-pending")
      .download(pendingPath);

    if (dlErr || !blob) {
      logger.error("api/gallery/approve", "download pending failed", {
        message: dlErr?.message,
      });
      return NextResponse.json({ error: "Could not read pending file" }, { status: 400 });
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const publicPath = `${row.uploaded_by}/${Date.now()}-${fileNameFromPath(pendingPath)}`;
    const contentType = blob.type || "image/jpeg";

    const { error: upErr } = await svc.storage.from("buddynagar-gallery").upload(publicPath, buf, {
      contentType,
      upsert: false,
    });

    if (upErr) {
      logger.error("api/gallery/approve", "public upload failed", { message: upErr.message });
      return NextResponse.json({ error: "Could not publish photo" }, { status: 400 });
    }

    const { data: pub } = svc.storage.from("buddynagar-gallery").getPublicUrl(publicPath);

    const { data: updated, error: updErr } = await svc
      .from("photo_gallery")
      .update({
        image_url: pub.publicUrl,
        pending_storage_path: null,
        is_approved: true,
      })
      .eq("id", id)
      .select("id, image_url")
      .maybeSingle();

    if (updErr || !updated?.image_url) {
      logger.error("api/gallery/approve", "db update failed", { message: updErr?.message });
      return NextResponse.json({ error: "Could not finalize approval" }, { status: 500 });
    }

    const { error: rmErr } = await svc.storage.from("buddynagar-gallery-pending").remove([pendingPath]);
    if (rmErr) {
      logger.error("api/gallery/approve", "pending delete failed", { message: rmErr.message });
    }

    return NextResponse.json({ ok: true, image_url: updated.image_url });
  }

  if (row.image_url) {
    const { error } = await supabase.from("photo_gallery").update({ is_approved: true }).eq("id", id);
    if (error) {
      logger.error("api/gallery/approve", "legacy update failed", { message: error.message });
      return NextResponse.json({ error: "Could not approve" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, image_url: row.image_url });
  }

  return NextResponse.json({ error: "Invalid row state" }, { status: 400 });
}
