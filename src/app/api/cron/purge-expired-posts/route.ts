import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { contentExpiryCutoffIso } from "@/lib/contentTtl";
import { parseSupabasePublicObjectUrl } from "@/lib/supabasePublicStorageUrl";
import { logger } from "@/lib/logger";

const REMOVE_CHUNK = 80;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function removePaths(svc: SupabaseClient, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += REMOVE_CHUNK) {
    const slice = unique.slice(i, i + REMOVE_CHUNK);
    const { error } = await svc.storage.from(bucket).remove(slice);
    if (error) {
      logger.error("api/cron/purge-expired-posts", "storage remove failed", {
        bucket,
        message: error.message,
      });
    }
  }
}

export async function GET(request: Request) {
  return runPurge(request);
}

export async function POST(request: Request) {
  return runPurge(request);
}

async function runPurge(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const cutoff = contentExpiryCutoffIso();
  const summary = {
    cinema_deleted: 0,
    poetry_deleted: 0,
    gallery_deleted: 0,
  };

  const { data: cinemaRows } = await svc
    .from("cinema_news")
    .select("id, image_url")
    .lt("published_at", cutoff);

  const cinemaPaths: string[] = [];
  for (const row of cinemaRows ?? []) {
    const p = parseSupabasePublicObjectUrl(row.image_url);
    if (p?.bucket === "buddynagar-cinema") cinemaPaths.push(p.path);
  }

  const { error: cinemaDelErr } = await svc.from("cinema_news").delete().lt("published_at", cutoff);
  if (cinemaDelErr) {
    logger.error("api/cron/purge-expired-posts", "cinema delete failed", {
      message: cinemaDelErr.message,
    });
  } else {
    summary.cinema_deleted = cinemaRows?.length ?? 0;
    await removePaths(svc, "buddynagar-cinema", cinemaPaths);
  }

  const { data: poetryRows } = await svc
    .from("poetry_wall")
    .select("id, image_url")
    .lt("posted_at", cutoff);

  const poetryPaths: string[] = [];
  for (const row of poetryRows ?? []) {
    const p = parseSupabasePublicObjectUrl(row.image_url);
    if (p?.bucket === "buddynagar-poetry") poetryPaths.push(p.path);
  }

  const { error: poetryDelErr } = await svc.from("poetry_wall").delete().lt("posted_at", cutoff);
  if (poetryDelErr) {
    logger.error("api/cron/purge-expired-posts", "poetry delete failed", {
      message: poetryDelErr.message,
    });
  } else {
    summary.poetry_deleted = poetryRows?.length ?? 0;
    await removePaths(svc, "buddynagar-poetry", poetryPaths);
  }

  const { data: galleryRows } = await svc
    .from("photo_gallery")
    .select("id, image_url, pending_storage_path")
    .lt("uploaded_at", cutoff);

  const galleryPublicPaths: string[] = [];
  const galleryPendingPaths: string[] = [];
  for (const row of galleryRows ?? []) {
    if (row.pending_storage_path) {
      galleryPendingPaths.push(row.pending_storage_path);
    }
    const p = parseSupabasePublicObjectUrl(row.image_url);
    if (p?.bucket === "buddynagar-gallery") galleryPublicPaths.push(p.path);
  }
  const { error: galleryDelErr } = await svc.from("photo_gallery").delete().lt("uploaded_at", cutoff);
  if (galleryDelErr) {
    logger.error("api/cron/purge-expired-posts", "gallery delete failed", {
      message: galleryDelErr.message,
    });
  } else {
    summary.gallery_deleted = galleryRows?.length ?? 0;
    await removePaths(svc, "buddynagar-gallery", galleryPublicPaths);
    await removePaths(svc, "buddynagar-gallery-pending", galleryPendingPaths);
  }

  logger.info("api/cron/purge-expired-posts", "purge completed", summary);

  return NextResponse.json({ ok: true, cutoff, ...summary });
}
