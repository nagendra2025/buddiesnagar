"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HorizontalCarousel,
  newsCarouselSlideClassName,
} from "@/components/ui/horizontal-carousel";
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
  const [newsHint, setNewsHint] = useState<string | null>(null);
  const [rssFallback, setRssFallback] = useState(false);
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
        newsApiHttpStatus?: number | null;
        newsApiErrorCode?: string | null;
        missingNewsApiKey?: boolean;
        usedRssFallback?: boolean;
      };
      setArticles(data.articles ?? []);
      setFallback(Boolean(data.fallback));
      setStale(Boolean(data.stale));
      setRssFallback(Boolean(data.usedRssFallback));

      let hint: string | null = null;
      if (data.fallback) {
        if (data.missingNewsApiKey) {
          hint =
            "Live headlines need NEWS_API_KEY on the server (e.g. Vercel → Environment Variables).";
        } else if (data.newsApiHttpStatus === 426) {
          hint =
            "NewsAPI’s free Developer plan is not allowed on production hosts (e.g. Vercel). You’ll need a paid NewsAPI plan or a different news source.";
        } else if (
          data.newsApiHttpStatus === 401 ||
          data.newsApiErrorCode === "apiKeyInvalid"
        ) {
          hint = "NewsAPI rejected the key — check that NEWS_API_KEY is correct.";
        } else if (typeof data.newsApiHttpStatus === "number" && data.newsApiHttpStatus >= 400) {
          hint = `NewsAPI returned HTTP ${data.newsApiHttpStatus}. Check Vercel function logs for details.`;
        }
      }
      setNewsHint(hint);
    } catch (e) {
      logger.error("NewsSection", "fetch failed", {
        message: e instanceof Error ? e.message : "unknown",
      });
      setArticles([]);
      setFallback(true);
      setStale(false);
      setNewsHint(null);
      setRssFallback(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch when category changes; load() sets loading state (async). ESLint’s
    // set-state-in-effect rule flags direct calls here — pattern is intentional.
    const t = window.setTimeout(() => {
      void load(category);
    }, 0);
    return () => window.clearTimeout(t);
  }, [category, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        (a.title ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q),
    );
  }, [articles, query]);

  const newsCarouselKey = useMemo(
    () => `${category}::${query}::${filtered.map((a) => a.id).join("|")}`,
    [category, query, filtered],
  );

  return (
    <section id="news" className="scroll-mt-20 py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Today&apos;s news
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Headlines are cached for a few hours so the page stays fast.
            </p>
            {rssFallback ? (
              <p className="mt-1 text-xs text-muted-foreground">
                These headlines come from public RSS feeds because NewsAPI is
                unavailable on this host (common on the free NewsAPI plan).
              </p>
            ) : null}
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
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p>
              {stale
                ? "Showing older cached headlines — a fresh fetch from NewsAPI did not succeed."
                : "No headlines to show yet — live fetch did not return any articles and there is no cache for this category."}
            </p>
            {newsHint ? <p className="text-foreground/90">{newsHint}</p> : null}
          </div>
        ) : null}

        {loading ? (
          <HorizontalCarousel
            className="mt-6"
            scrollResetKey={category}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={newsCarouselSlideClassName}>
                <Card className="h-full">
                  <CardContent className="space-y-2 p-4">
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              </div>
            ))}
          </HorizontalCarousel>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <p className="mt-6 text-center text-muted-foreground">
            No articles for this filter.
          </p>
        ) : null}
        {!loading && filtered.length > 0 ? (
          <HorizontalCarousel
            className="mt-6"
            scrollResetKey={newsCarouselKey}
          >
            {filtered.map((a) => (
              <div key={a.id} className={newsCarouselSlideClassName}>
                <Card className="h-full overflow-hidden">
                  <CardContent className="p-0">
                    {a.image_url ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
                        <Image
                          src={a.image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 767px) 85vw, 32vw"
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
              </div>
            ))}
          </HorizontalCarousel>
        ) : null}
      </div>
    </section>
  );
}
