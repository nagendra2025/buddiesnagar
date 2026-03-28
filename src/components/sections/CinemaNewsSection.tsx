"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CinemaIndustry, CinemaNewsRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  HorizontalCarousel,
  carouselSlideClassName,
} from "@/components/ui/horizontal-carousel";
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
import { Heart, Clapperboard } from "lucide-react";
import { logger } from "@/lib/logger";
import { safeStorageFileName } from "@/lib/storagePaths";

const INDUSTRIES: Array<CinemaIndustry | "All"> = [
  "All",
  "Telugu",
  "Hindi",
  "Tamil",
  "Hollywood",
];

interface CinemaNewsSectionProps {
  initialItems: CinemaNewsRow[];
  userId: string | null;
  canPost: boolean;
  likedIds: string[];
}

export default function CinemaNewsSection({
  initialItems,
  userId,
  canPost,
  likedIds: initialLiked,
}: CinemaNewsSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<CinemaIndustry | "All">("All");
  const [liked, setLiked] = useState(() => new Set(initialLiked));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [movieName, setMovieName] = useState("");
  const [industry, setIndustry] = useState<CinemaIndustry>("Telugu");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((i) => i.industry === filter);
  }, [items, filter]);

  const cinemaCarouselKey = useMemo(
    () => `${filter}::${filtered.map((i) => i.id).join("|")}`,
    [filter, filtered],
  );

  async function onLike(id: string) {
    if (!userId || liked.has(id)) return;
    const res = await fetch(`/api/cinema/${id}/like`, { method: "POST" });
    if (res.ok) {
      setLiked((prev) => new Set(prev).add(id));
      setItems((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, likes: (r.likes ?? 0) + 1 } : r,
        ),
      );
    }
  }

  async function submitPost() {
    if (!userId || !title.trim()) return;
    setBusy(true);
    try {
      const supabase = createClient();
      let imageUrl: string | null = null;
      if (file) {
        const path = `${userId}/${Date.now()}-${safeStorageFileName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("buddynagar-cinema")
          .upload(path, file, { upsert: false });
        if (upErr) {
          logger.error("CinemaNewsSection", "upload failed", {
            message: upErr.message,
          });
          setBusy(false);
          return;
        }
        const { data: pub } = supabase.storage
          .from("buddynagar-cinema")
          .getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
      const { data: row, error } = await supabase
        .from("cinema_news")
        .insert({
          posted_by: userId,
          title: title.trim(),
          movie_name: movieName.trim() || null,
          content: content.trim() || null,
          image_url: imageUrl,
          industry,
          is_published: true,
        })
        .select("*, profiles!posted_by(full_name)")
        .single();
      if (error) {
        logger.error("CinemaNewsSection", "insert failed", {
          message: error.message,
        });
        setBusy(false);
        return;
      }
      if (row) {
        setItems((prev) => [row as CinemaNewsRow, ...prev]);
      }
      setOpen(false);
      setTitle("");
      setMovieName("");
      setContent("");
      setFile(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="cinema" className="scroll-mt-20 border-b border-border py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Cinema buzz
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Telugu screens and beyond — posts from admins and cinema posters. Each post is removed
              automatically 100 hours after it was published.
            </p>
          </div>
          {canPost ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => setOpen(true)}
            >
              <Clapperboard className="h-4 w-4" aria-hidden />
              Post update
            </Button>
          ) : userId ? (
            <p className="max-w-sm text-sm text-muted-foreground">
              Only{" "}
              <span className="font-medium text-foreground">admins</span> and{" "}
              <span className="font-medium text-foreground">cinema posters</span>{" "}
              can publish here. Ask an admin if you need the cinema poster role.
            </p>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              <a href="#hero" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in
              </a>{" "}
              (hero section) to post cinema updates — if your account has permission.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <Button
              key={ind}
              type="button"
              size="sm"
              variant={filter === ind ? "default" : "outline"}
              onClick={() => setFilter(ind)}
            >
              {ind}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 text-center text-muted-foreground">
            No posts in this filter yet.
          </p>
        ) : (
          <HorizontalCarousel className="mt-4" scrollResetKey={cinemaCarouselKey}>
            {filtered.map((item) => (
              <div key={item.id} className={carouselSlideClassName}>
                <Card className="h-full overflow-hidden">
                  <CardContent className="p-0">
                    {item.image_url ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
                        <Image
                          src={item.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="320px"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2 p-4">
                      <p className="text-xs font-medium uppercase text-primary">
                        {item.industry}
                        {item.movie_name ? ` · ${item.movie_name}` : ""}
                      </p>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      {item.content ? (
                        <p className="line-clamp-4 text-sm text-muted-foreground">
                          {item.content}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        By {item.profiles?.full_name ?? "Buddy"}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
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
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </HorizontalCarousel>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New cinema post</DialogTitle>
            <DialogDescription>
              Image optional. Visible to everyone once saved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cin-title">Title</Label>
              <Input
                id="cin-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cin-movie">Movie name (optional)</Label>
              <Input
                id="cin-movie"
                value={movieName}
                onChange={(e) => setMovieName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cin-ind">Industry</Label>
              <select
                id="cin-ind"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={industry}
                onChange={(e) =>
                  setIndustry(e.target.value as CinemaIndustry)
                }
              >
                {(["Telugu", "Hindi", "Tamil", "Hollywood"] as const).map(
                  (x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cin-body">Notes (optional)</Label>
              <Textarea
                id="cin-body"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cin-img">Poster image (optional)</Label>
              <Input
                id="cin-img"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) =>
                  setFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
            <Button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void submitPost()}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
