import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  readCachedJson,
  readCachedJsonStaleFallback,
  writeCachedJson,
} from "@/lib/apiResponseCache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000;
/** CricAPI can be slow; 20s reduces spurious aborts vs 10s. */
const FETCH_TIMEOUT_MS = 20_000;
/** If live fetch fails, serve last successful payload up to this age (ms). */
const STALE_FALLBACK_MAX_MS = 36 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 400;

export type CricketMatchBrief = {
  id: string;
  name: string;
  status: string;
  matchType: string | null;
  team1: string | null;
  team2: string | null;
};

type CricketPayload = {
  ok: true;
  matches: CricketMatchBrief[];
  cached: boolean;
};

type CricMatch = {
  id?: string;
  name?: string;
  status?: string;
  matchType?: string;
  teams?: string[];
  teamInfo?: {
    team1?: { name?: string };
    team2?: { name?: string };
  };
};

type CricResponse = {
  status?: string;
  data?: CricMatch[];
  reason?: string;
};

const CACHE_KEY = "cricket:currentMatches";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function staleCricketResponse(): Promise<NextResponse | null> {
  const stale = await readCachedJsonStaleFallback<CricketPayload>(
    CACHE_KEY,
    STALE_FALLBACK_MAX_MS,
  );
  if (stale?.body?.ok) {
    return NextResponse.json({ ...stale.body, cached: true });
  }
  return null;
}

function cricketApiKey(): string | undefined {
  return (
    process.env.CRICKET_API_KEY?.trim() ||
    process.env.CRIC_API_KEY?.trim() ||
    process.env.CRICAPI_API_KEY?.trim()
  );
}

function mapMatch(m: CricMatch): CricketMatchBrief {
  let t1 = m.teamInfo?.team1?.name ?? null;
  let t2 = m.teamInfo?.team2?.name ?? null;
  const teams = m.teams;
  if ((!t1 || !t2) && Array.isArray(teams) && teams.length >= 2) {
    t1 = t1 ?? teams[0] ?? null;
    t2 = t2 ?? teams[1] ?? null;
  }
  return {
    id: String(m.id ?? m.name ?? Math.random().toString(36).slice(2)),
    name: (m.name ?? "Match").trim(),
    status: (m.status ?? "—").trim(),
    matchType: m.matchType?.trim() ?? null,
    team1: t1,
    team2: t2,
  };
}

export async function GET() {
  const apiKey = cricketApiKey();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      missingApiKey: true,
      matches: [] as CricketMatchBrief[],
      message: "Set CRICKET_API_KEY (or CRIC_API_KEY) for live scores.",
    });
  }

  const cached = await readCachedJson<CricketPayload>(CACHE_KEY, TTL_MS);
  if (cached?.body?.ok) {
    return NextResponse.json({ ...cached.body, cached: true });
  }

  const url = new URL("https://api.cricapi.com/v1/currentMatches");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("offset", "0");
  const urlStr = url.toString();

  async function fetchOnce(): Promise<Response> {
    return fetch(urlStr, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }

  let res: Response;
  try {
    res = await fetchOnce();
  } catch (e) {
    logger.warn("api/cricket", "fetch failed (will retry once)", {
      message: e instanceof Error ? e.message : String(e),
    });
    await sleep(RETRY_DELAY_MS);
    try {
      res = await fetchOnce();
    } catch (e2) {
      logger.warn("api/cricket", "fetch failed after retry", {
        message: e2 instanceof Error ? e2.message : String(e2),
      });
      const fallback = await staleCricketResponse();
      if (fallback) return fallback;
      return NextResponse.json(
        { ok: false, error: "Cricket API unreachable.", matches: [] },
        { status: 502 },
      );
    }
  }

  let raw: CricResponse;
  try {
    raw = (await res.json()) as CricResponse;
  } catch {
    const fallback = await staleCricketResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      { ok: false, error: "Invalid cricket response.", matches: [] },
      { status: 502 },
    );
  }

  if (!res.ok || raw.status === "failure") {
    logger.warn("api/cricket", "provider error", {
      http: res.status,
      reason: raw.reason,
    });
    const fallback = await staleCricketResponse();
    if (fallback) return fallback;
    return NextResponse.json(
      {
        ok: false,
        error: raw.reason ?? "Cricket provider returned an error.",
        matches: [] as CricketMatchBrief[],
      },
      { status: res.ok ? 502 : res.status },
    );
  }

  const list = Array.isArray(raw.data) ? raw.data : [];
  const body: CricketPayload = {
    ok: true,
    matches: list.slice(0, 12).map(mapMatch),
    cached: false,
  };

  const svc = createServiceClient();
  if (svc) {
    await writeCachedJson(CACHE_KEY, body);
  }

  return NextResponse.json(body);
}
