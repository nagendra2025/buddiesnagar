import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendGalleryPendingNotification } from "@/lib/gallery-notify-email";
import { logger } from "@/lib/logger";
import { safeStorageFileName } from "@/lib/storagePaths";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Image file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads allowed" }, { status: 400 });
  }

  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string).trim() : "";
  const yearApprox =
    typeof form.get("yearApprox") === "string" ? (form.get("yearApprox") as string).trim() : "";

  const objectPath = `${user.id}/${Date.now()}-${safeStorageFileName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await svc.storage
    .from("buddynagar-gallery-pending")
    .upload(objectPath, buf, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    logger.error("api/gallery/submit", "pending upload failed", { message: upErr.message });
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }

  const { data: row, error: insErr } = await svc
    .from("photo_gallery")
    .insert({
      uploaded_by: user.id,
      image_url: null,
      pending_storage_path: objectPath,
      caption: caption || null,
      year_approx: yearApprox || null,
      is_approved: false,
    })
    .select("id, profiles!uploaded_by(full_name)")
    .single();

  if (insErr || !row) {
    logger.error("api/gallery/submit", "insert failed", { message: insErr?.message });
    await svc.storage.from("buddynagar-gallery-pending").remove([objectPath]);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }

  const prof = row.profiles as { full_name?: string } | { full_name?: string }[] | null;
  const fullName = Array.isArray(prof) ? prof[0]?.full_name : prof?.full_name;

  const { data: signed, error: signErr } = await svc.storage
    .from("buddynagar-gallery-pending")
    .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

  const previewUrl = !signErr && signed?.signedUrl ? signed.signedUrl : "";
  if (!previewUrl) {
    logger.error("api/gallery/submit", "signed url for email failed", { message: signErr?.message });
  }

  await sendGalleryPendingNotification({
    photoId: row.id,
    imageUrl: previewUrl,
    caption: caption || null,
    yearApprox: yearApprox || null,
    uploaderName: fullName ?? null,
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
  });
}
