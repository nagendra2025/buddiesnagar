import type { NewsArticle } from "@/lib/types";

/** Public RSS feeds (no API key). Used when NewsAPI fails or is unavailable in production. */
const CATEGORY_FEEDS: Record<string, string[]> = {
  "Telugu News": [
    "https://www.thehindu.com/news/national/telangana/feeder/default.rss",
    "http://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
  ],
  National: [
    "http://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
    "https://feeds.feedburner.com/ndtvnews-india-news",
  ],
  World: ["http://feeds.bbci.co.uk/news/world/rss.xml"],
  Cricket: ["http://feeds.bbci.co.uk/sport/cricket/rss.xml"],
  Technology: ["http://feeds.bbci.co.uk/news/technology/rss.xml"],
  "Health & Wellness": ["http://feeds.bbci.co.uk/news/health/rss.xml"],
  "Finance & Markets": ["http://feeds.bbci.co.uk/news/business/rss.xml"],
  Entertainment: [
    "http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  ],
  Science: ["http://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
};

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeXml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getTag(block: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  );
  const m = block.match(re);
  if (!m) return null;
  return decodeXml(m[1]).trim();
}

function imageFromItem(block: string): string | null {
  const thumb = block.match(/media:thumbnail[^>]*\burl="([^"]+)"/i);
  if (thumb) return thumb[1];
  const content = block.match(/media:content[^>]*\burl="([^"]+)"/i);
  if (content) return content[1];
  const enc = block.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image\//i);
  return enc ? enc[1] : null;
}

function parseRssItems(xml: string, category: string, limit: number): NewsArticle[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const now = new Date().toISOString();
  const out: NewsArticle[] = [];

  for (const [, inner] of items) {
    if (!inner) continue;
    const title = getTag(inner, "title");
    let link = getTag(inner, "link");
    if (!link) {
      const guid = getTag(inner, "guid");
      if (guid && /^https?:\/\//i.test(guid)) link = guid;
    }
    if (!title || !link) continue;

    const descRaw = getTag(inner, "description") ?? "";
    const pub = getTag(inner, "pubDate");
    const image_url = imageFromItem(inner);
    const description = descRaw ? stripTags(descRaw).slice(0, 500) : null;

    out.push({
      id: `rss-${category}-${out.length}-${link.slice(0, 80)}`,
      category,
      title,
      description,
      url: link,
      image_url,
      source_name: "RSS",
      published_at: pub || null,
      fetched_at: now,
    });
    if (out.length >= limit) break;
  }

  return out;
}

export async function fetchNewsFromRss(
  category: string,
  limit: number,
): Promise<NewsArticle[]> {
  const feeds = CATEGORY_FEEDS[category] ?? CATEGORY_FEEDS.World;
  const headers = {
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "User-Agent": "BuddyNagar/1.0 (community news reader; +https://buddiesnagar.vercel.app)",
  };

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers,
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml.includes("<item")) continue;
      const articles = parseRssItems(xml, category, limit);
      if (articles.length > 0) return articles;
    } catch {
      /* try next feed */
    }
  }

  return [];
}
