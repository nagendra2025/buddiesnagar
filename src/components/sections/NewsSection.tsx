"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper } from "lucide-react";
import { logger } from "@/lib/logger";

export default function NewsSection({
  defaultCategory,
}: {
  defaultCategory: NewsCategory;
}) {
  const [category, setCategory] = useState<NewsCategory>(defaultCategory);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [stale, setStale] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (cat: NewsCategory) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/news?category=${encodeURIComponent(cat)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        articles?: NewsArticle[];
        fallback?: boolean;
        stale?: boolean;
      };
      setArticles(data.articles ?? []);
      setFallback(Boolean(data.fallback));
      setStale(Boolean(data.stale));
    } catch (e) {
      logger.error("NewsSection", "fetch failed", {
        message: e instanceof Error ? e.message : "unknown",
      });
      setArticles([]);
      setFallback(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  const filtered = articles.filter((a) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (a.title ?? "").toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <section id="news" className="scroll-mt-20 py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Today&apos;s news
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Headlines cached for speed — add{" "}
              <code className="rounded bg-muted px-1">NEWS_API_KEY</code> for
              fresh fetches.
            </p>
          </div>
          <Newspaper className="hidden h-8 w-8 text-primary md:block" aria-hidden />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {NEWS_CATEGORIES.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={c === category ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium">
          Search in results
          <input
            className="mt-1 flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base md:text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter headlines…"
          />
        </label>

        {fallback ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {stale
              ? "Showing older cached headlines — live fetch unavailable."
              : "No live headlines right now. Configure NewsAPI or check back later."}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            : null}
          {!loading && filtered.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground">
              No articles for this filter.
            </p>
          ) : null}
          {!loading
            ? filtered.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-0">
                    {a.image_url ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
                        <Image
                          src={a.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width:768px) 100vw, 50vw"
                          unoptimized
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2 p-4">
                      <p className="text-xs uppercase text-muted-foreground">
                        {a.source_name ?? "News"}
                      </p>
                      <h3 className="text-lg font-semibold leading-snug">
                        {a.title}
                      </h3>
                      {a.description ? (
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {a.description}
                        </p>
                      ) : null}
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Read more
                        </a>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            : null}
        </div>
      </div>
    </section>
  );
}
