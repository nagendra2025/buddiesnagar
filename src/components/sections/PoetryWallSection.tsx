"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PoetryLanguage, PoetryWallRow } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, PenLine } from "lucide-react";
import { logger } from "@/lib/logger";
import { safeStorageFileName } from "@/lib/storagePaths";

const LANGS: Array<PoetryLanguage | "All"> = ["All", "Telugu", "Urdu", "Hindi", "English"];

interface PoetryWallSectionProps {
  initialItems: PoetryWallRow[];
  userId: string | null;
  canPost: boolean;
  likedIds: string[];
}

export default function PoetryWallSection(props: PoetryWallSectionProps) {
  const { initialItems, userId, canPost, likedIds: initialLiked } = props;
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<PoetryLanguage | "All">("All");
  const [liked, setLiked] = useState(() => new Set(initialLiked));
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<PoetryWallRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [poetName, setPoetName] = useState("");
  const [language, setLanguage] = useState<PoetryLanguage>("Telugu");

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((i) => i.language === filter);
  }, [items, filter]);

  async function onLike(id: string) {
    if (!userId || liked.has(id)) return;
    const res = await fetch("/api/poetry/" + id + "/like", { method: "POST" });
    if (res.ok) {
      setLiked((prev) => new Set(prev).add(id));
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, likes: (r.likes ?? 0) + 1 } : r)),
      );
    }
  }

  async function submitPoem() {
    if (!userId || !file) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const path = userId + "/" + Date.now() + "-" + safeStorageFileName(file.name);
      const { error: upErr } = await supabase.storage
        .from("buddynagar-poetry")
        .upload(path, file, { upsert: false });
      if (upErr) {
        logger.error("PoetryWallSection", "upload failed", { message: upErr.message });
        setBusy(false);
        return;
      }
      const { data: pub } = supabase.storage.from("buddynagar-poetry").getPublicUrl(path);
      const { data: row, error } = await supabase
        .from("poetry_wall")
        .insert({
          posted_by: userId,
          image_url: pub.publicUrl,
          caption: caption.trim() || null,
          poet_name: poetName.trim() || null,
          language,
          is_published: true,
        })
        .select("*, profiles!posted_by(full_name)")
        .single();
      if (error) {
        logger.error("PoetryWallSection", "insert failed", { message: error.message });
        setBusy(false);
        return;
      }
      if (row) setItems((prev) => [row as PoetryWallRow, ...prev]);
      setOpen(false);
      setFile(null);
      setCaption("");
      setPoetName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="poetry" className="scroll-mt-20 border-b border-border py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Poets corner</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Poetry images from the group. Tap to enlarge. Posts are removed automatically 100 hours
              after posting.
            </p>
          </div>
          {canPost ? (
            <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
              <PenLine className="h-4 w-4" aria-hidden />
              Post a poem
            </Button>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <Button
              key={l}
              type="button"
              size="sm"
              variant={filter === l ? "default" : "outline"}
              onClick={() => setFilter(l)}
            >
              {l}
            </Button>
          ))}
        </div>

        <div className="mt-6 columns-2 gap-3 md:columns-3" style={{ columnGap: "0.75rem" }}>
          {filtered.length === 0 ? (
            <p className="break-inside-avoid text-center text-muted-foreground">
              No poems in this filter yet.
            </p>
          ) : (
            filtered.map((item) => (
              <Card key={item.id} className="mb-3 break-inside-avoid overflow-hidden">
                <button
                  type="button"
                  className="relative block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setLightbox(item)}
                >
                  <Image
                    src={item.image_url}
                    alt={item.caption ?? "Poetry"}
                    width={800}
                    height={1200}
                    className="h-auto w-full object-cover"
                    sizes="(max-width:768px) 50vw, 33vw"
                  />
                </button>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.language}</Badge>
                    {item.poet_name ? (
                      <span className="text-xs text-muted-foreground">{item.poet_name}</span>
                    ) : null}
                  </div>
                  {item.caption ? <p className="line-clamp-3 text-sm">{item.caption}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    By {item.profiles?.full_name ?? "Buddy"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!userId || liked.has(item.id)}
                    className="gap-1"
                    onClick={() => void onLike(item.id)}
                  >
                    <Heart
                      className={
                        liked.has(item.id) ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"
                      }
                      aria-hidden
                    />
                    {item.likes ?? 0}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Poetry image</DialogTitle>
            <DialogDescription>Full size poetry image</DialogDescription>
          </DialogHeader>
          {lightbox ? (
            <div className="overflow-hidden rounded-xl bg-card">
              <Image
                src={lightbox.image_url}
                alt={lightbox.caption ?? ""}
                width={1200}
                height={1600}
                className="h-auto max-h-[80vh] w-full object-contain"
              />
              {lightbox.caption ? <p className="p-4 text-sm">{lightbox.caption}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share a poem</DialogTitle>
            <DialogDescription>Upload an image. It appears on the wall for everyone.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="p-img">Image</Label>
              <Input
                id="p-img"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-poet">Poet name (optional)</Label>
              <Input id="p-poet" value={poetName} onChange={(e) => setPoetName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-cap">Caption (optional)</Label>
              <Textarea id="p-cap" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-lang">Language</Label>
              <select
                id="p-lang"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value as PoetryLanguage)}
              >
                {(["Telugu", "Urdu", "Hindi", "English"] as const).map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" disabled={busy || !file} onClick={() => void submitPoem()}>
              {busy ? "Posting" : "Post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
