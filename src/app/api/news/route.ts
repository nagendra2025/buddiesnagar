import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { NewsArticle } from "@/lib/types";

const TTL_MS = 2 * 60 * 60 * 1000;

function mapCategoryToNewsApi(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("cricket")) return "sports";
  if (c.includes("technology")) return "technology";
  if (c.includes("science")) return "science";
  if (c.includes("entertainment")) return "entertainment";
  if (c.includes("health")) return "health";
  if (c.includes("finance")) return "business";
  if (c.includes("telugu")) return "general";
  if (c.includes("national")) return "general";
  if (c.includes("world")) return "general";
  return "general";
}

type NewsApiFetchResult = {
  articles: NewsArticle[];
  newsApiHttpStatus?: number;
  newsApiErrorCode?: string;
};

async function fetchFromNewsApi(category: string): Promise<NewsApiFetchResult> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return { articles: [] };

  const q = mapCategoryToNewsApi(category);
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("language", "en");
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("apiKey", key);
  if (q === "sports") {
    url.searchParams.set("category", "sports");
    url.searchParams.set("country", "in");
  } else if (q === "technology" || q === "science" || q === "health" || q === "business" || q === "entertainment") {
    url.searchParams.set("category", q);
    url.searchParams.set("country", "in");
  } else {
    url.searchParams.set("country", "in");
  }

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const raw = (await res.json()) as {
    status?: string;
    code?: string;
    message?: string;
    articles?: Array<{
      title?: string;
      description?: string;
      url?: string;
      urlToImage?: string;
      source?: { name?: string };
      publishedAt?: string;
    }>;
  };

  if (!res.ok) {
    logger.warn("api/news", "NewsAPI request failed", { status: res.status });
    return { articles: [], newsApiHttpStatus: res.status };
  }
  if (raw.status === "error") {
    logger.warn("api/news", "NewsAPI error body", {
      code: raw.code,
      message: raw.message,
    });
    return {
      articles: [],
      newsApiHttpStatus: res.status,
      newsApiErrorCode: raw.code,
    };
  }

  const articles = raw.articles ?? [];
  const now = new Date().toISOString();
  const mapped = articles
    .filter((a) => a.title && a.url)
    .map((a, i) => ({
      id: `${category}-${i}-${a.url}`,
      category,
      title: a.title ?? null,
      description: a.description ?? null,
      url: a.url ?? null,
      image_url: a.urlToImage ?? null,
      source_name: a.source?.name ?? null,
      published_at: a.publishedAt ?? null,
      fetched_at: now,
    }));
  return { articles: mapped };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "Cricket";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { articles: [] as NewsArticle[], fallback: true, reason: "no_supabase" },
      { status: 200 },
    );
  }

  const readClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - TTL_MS).toISOString();
  const { data: cached, error: cacheReadError } = await readClient
    .from("news_articles_cache")
    .select("*")
    .eq("category", category)
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(12);

  if (cacheReadError) {
    logger.error("api/news", "cache read failed", { message: cacheReadError.message });
  }

  if (cached && cached.length > 0) {
    return NextResponse.json({
      articles: cached as NewsArticle[],
      fallback: false,
      stale: false,
    });
  }

  const {
    articles: fresh,
    newsApiHttpStatus,
    newsApiErrorCode,
  } = await fetchFromNewsApi(category);
  const service = createServiceClient();

  if (fresh.length > 0) {
    if (service) {
      const rows = fresh.map((a) => ({
        category: a.category,
        title: a.title,
        description: a.description,
        url: a.url,
        image_url: a.image_url,
        source_name: a.source_name,
        published_at: a.published_at,
        fetched_at: a.fetched_at,
      }));
      const { error: insErr } = await service.from("news_articles_cache").insert(rows);
      if (insErr) {
        logger.error("api/news", "cache insert failed", { message: insErr.message });
      }
    }
    return NextResponse.json({ articles: fresh, fallback: false, stale: false });
  }

  const { data: staleRows } = await readClient
    .from("news_articles_cache")
    .select("*")
    .eq("category", category)
    .order("fetched_at", { ascending: false })
    .limit(12);

  const staleList = (staleRows ?? []) as NewsArticle[];
  const hasKey = Boolean(process.env.NEWS_API_KEY);

  return NextResponse.json({
    articles: staleList,
    fallback: true,
    stale: staleList.length > 0,
    newsApiHttpStatus: newsApiHttpStatus ?? null,
    newsApiErrorCode: newsApiErrorCode ?? null,
    missingNewsApiKey: !hasKey,
  });
}
