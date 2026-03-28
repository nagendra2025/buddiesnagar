"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { GalleryPhotoRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Heart, ImagePlus } from "lucide-react";
import { logger } from "@/lib/logger";
function displaySrc(row: GalleryPhotoRow): string {
  return (row.preview_url || row.image_url || "").trim();
}

interface MemoryLaneSectionProps {
  initialItems: GalleryPhotoRow[];
  userId: string | null;
  isAdmin: boolean;
  likedIds: string[];
}

export default function MemoryLaneSection({
  initialItems,
  userId,
  isAdmin,
  likedIds: initialLiked,
}: MemoryLaneSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [liked, setLiked] = useState(() => new Set(initialLiked));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [yearApprox, setYearApprox] = useState("");
  const [lightbox, setLightbox] = useState<GalleryPhotoRow | null>(null);

  async function onLike(id: string) {
    if (!userId || liked.has(id)) return;
    const res = await fetch(`/api/gallery/${id}/like`, { method: "POST" });
    if (res.ok) {
      setLiked((prev) => new Set(prev).add(id));
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, likes: (r.likes ?? 0) + 1 } : r)),
      );
    }
  }

  async function submitMemory() {
    if (!userId || !file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("caption", caption.trim());
      fd.set("yearApprox", yearApprox.trim());
      const res = await fetch("/api/gallery/submit", { method: "POST", body: fd });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        logger.error("MemoryLaneSection", "submit failed", {
          status: res.status,
          message: err?.error,
        });
        return;
      }
      setOpen(false);
      setFile(null);
      setCaption("");
      setYearApprox("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approvePhoto(id: string) {
    const res = await fetch(`/api/gallery/${id}/approve`, { method: "POST" });
    if (!res.ok) return;
    const data = (await res.json().catch(() => ({}))) as { image_url?: string | null };
    setItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              is_approved: true,
              image_url: data.image_url ?? r.image_url,
              pending_storage_path: null,
              preview_url: undefined,
            }
          : r,
      ),
    );
    router.refresh();
  }

  const approved = items.filter((i) => i.is_approved && (i.image_url?.length ?? 0) > 0);
  const pendingAll = items.filter((i) => !i.is_approved);
  const pendingMine = userId
    ? items.filter((i) => !i.is_approved && i.uploaded_by === userId)
    : [];

  return (
    <section id="memories" className="scroll-mt-20 border-b border-border py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Memory lane</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Photos stay private until an admin approves; only then they appear in the gallery below.
              Approved memories are removed automatically 100 hours after upload so the wall stays fresh.
            </p>
          </div>
          {userId ? (
            <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
              <ImagePlus className="h-4 w-4" aria-hidden />
              Add a memory
            </Button>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              <a href="#sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
                Get login link
              </a>
              {" — "}
              use your registered email.
            </p>
          )}
        </div>

        {isAdmin && pendingAll.length > 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium">Pending review ({pendingAll.length})</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Approve to copy the file into the public gallery. The admin inbox received an email when
              each memory was submitted (Memory lane only).
            </p>
            <ul className="mt-4 flex flex-col gap-4">
              {pendingAll.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    className="relative h-24 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-20 sm:w-28"
                    onClick={() => displaySrc(p) && setLightbox(p)}
                  >
                    {displaySrc(p) ? (
                      <Image
                        src={displaySrc(p)}
                        alt={p.caption ?? "Pending memory"}
                        fill
                        className="object-cover"
                        sizes="112px"
                        unoptimized={Boolean(p.preview_url)}
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Preview…
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{p.caption || "Untitled"}</p>
                    <p className="text-muted-foreground">
                      {p.year_approx || "Year ?"} · By {p.profiles?.full_name ?? "Buddy"}
                    </p>
                  </div>
                  <Button type="button" className="shrink-0" onClick={() => void approvePhoto(p.id)}>
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!isAdmin && pendingMine.length > 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-amber-500/50 bg-amber-50/50 p-4">
            <p className="text-sm font-medium text-amber-900">Waiting for approval ({pendingMine.length})</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {pendingMine.map((p) => (
                <li key={p.id} className="text-xs text-muted-foreground">
                  {p.caption || "Untitled"} · {p.year_approx || "Year ?"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 columns-2 gap-3 md:columns-3">
          {approved.length === 0 &&
          pendingMine.length === 0 &&
          (!isAdmin || pendingAll.length === 0) ? (
            <p className="break-inside-avoid text-center text-muted-foreground">No memories yet.</p>
          ) : null}
          {approved.map((item) => (
            <Card key={item.id} className="mb-3 break-inside-avoid overflow-hidden">
              <button
                type="button"
                className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setLightbox(item)}
              >
                <Image
                  src={item.image_url!}
                  alt={item.caption ?? "Memory"}
                  width={800}
                  height={800}
                  className="h-auto w-full object-cover"
                  sizes="(max-width:768px) 50vw, 33vw"
                />
              </button>
              <div className="space-y-2 p-3">
                {item.year_approx ? <Badge variant="secondary">{item.year_approx}</Badge> : null}
                {item.caption ? <p className="line-clamp-2 text-sm">{item.caption}</p> : null}
                <p className="text-xs text-muted-foreground">By {item.profiles?.full_name ?? "Buddy"}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!userId || liked.has(item.id)}
                  className="gap-1"
                  onClick={() => void onLike(item.id)}
                >
                  <Heart
                    className={`h-4 w-4 ${liked.has(item.id) ? "fill-primary text-primary" : ""}`}
                    aria-hidden
                  />
                  {item.likes ?? 0}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Photo</DialogTitle>
            <DialogDescription>Full size memory photo</DialogDescription>
          </DialogHeader>
          {lightbox ? (
            displaySrc(lightbox) ? (
              <div className="overflow-hidden rounded-xl bg-card">
                <Image
                  src={displaySrc(lightbox)}
                  alt={lightbox.caption ?? ""}
                  width={1200}
                  height={1200}
                  className="h-auto max-h-[80vh] w-full object-contain"
                  unoptimized={Boolean(lightbox.preview_url)}
                />
                {lightbox.caption ? <p className="p-4 text-sm">{lightbox.caption}</p> : null}
              </div>
            ) : (
              <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground">
                Preview link expired — refresh the page to load a new preview.
              </p>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a memory</DialogTitle>
            <DialogDescription>
              Your file is stored privately until an admin approves; then it appears in Memory lane. The
              admin gets an email (Memory lane only).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="g-img">Photo</Label>
              <Input
                id="g-img"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="g-cap">Caption (optional)</Label>
              <Input id="g-cap" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="g-year">Approx. year (optional)</Label>
              <Input
                id="g-year"
                placeholder="1992, Reunion 2024"
                value={yearApprox}
                onChange={(e) => setYearApprox(e.target.value)}
              />
            </div>
            <Button type="button" disabled={busy || !file} onClick={() => void submitMemory()}>
              {busy ? "Uploading…" : "Submit for approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
