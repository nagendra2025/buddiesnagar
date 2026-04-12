import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readCachedJson, writeCachedJson } from "@/lib/apiResponseCache";
import { logger } from "@/lib/logger";
import {
  countrySuffixForOpenWeather,
  defaultWeatherQueryFromProfileTimezone,
} from "@/lib/profileTimezones";

export const dynamic = "force-dynamic";

const TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

type WeatherPayload = {
  ok: true;
  locationLabel: string;
  tempC: number;
  feelsLikeC: number;
  description: string;
  iconCode: string;
  humidity: number | null;
  windMps: number | null;
  cached: boolean;
  /** When `profile`, OpenWeather `q` came from `profiles.city` and/or `profiles.timezone`. */
  weatherSource?: "profile" | "default";
};

type OwWeather = {
  name?: string;
  main?: { temp?: number; feels_like?: number; humidity?: number };
  weather?: Array<{ description?: string; icon?: string }>;
  wind?: { speed?: number };
};

function defaultWeatherQuery(): string {
  const q = process.env.WEATHER_QUERY?.trim();
  return q && q.length > 0 ? q : "Kadapa,IN";
}

/** Build OpenWeather `q` from profile city; use `timezone` for `,CC` when city has no country. */
function openWeatherQueryFromCityAndTimezone(city: string, timezone: string): string {
  const t = city.trim();
  if (!t) return defaultWeatherQuery();
  if (t.includes(",")) return t;
  return `${t},${countrySuffixForOpenWeather(timezone)}`;
}

async function resolveWeatherQuery(): Promise<{
  q: string;
  weatherSource: "profile" | "default";
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { q: defaultWeatherQuery(), weatherSource: "default" };
    }
    const { data: row } = await supabase
      .from("profiles")
      .select("city, timezone")
      .eq("id", user.id)
      .maybeSingle();
    const city = typeof row?.city === "string" ? row.city.trim() : "";
    const timezone = typeof row?.timezone === "string" ? row.timezone.trim() : "";

    if (city) {
      return {
        q: openWeatherQueryFromCityAndTimezone(city, timezone),
        weatherSource: "profile",
      };
    }

    const qFromTz = defaultWeatherQueryFromProfileTimezone(timezone);
    if (qFromTz) {
      return { q: qFromTz, weatherSource: "profile" };
    }

    return { q: defaultWeatherQuery(), weatherSource: "default" };
  } catch (e) {
    logger.warn("api/weather", "resolve query (using default)", {
      message: e instanceof Error ? e.message : String(e),
    });
    return { q: defaultWeatherQuery(), weatherSource: "default" };
  }
}

function cacheKeyFor(q: string): string {
  return `weather:${q}`;
}

function titleCaseDescription(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      missingApiKey: true,
      message: "Set OPENWEATHER_API_KEY for live weather.",
    });
  }

  const { q, weatherSource } = await resolveWeatherQuery();
  const key = cacheKeyFor(q);
  const cached = await readCachedJson<WeatherPayload>(key, TTL_MS);
  if (cached?.body?.ok) {
    return NextResponse.json({
      ...cached.body,
      cached: true,
      weatherSource: cached.body.weatherSource ?? weatherSource,
    });
  }
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", q);
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    logger.warn("api/weather", "fetch failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: "Weather service unreachable." },
      { status: 502 },
    );
  }

  let raw: OwWeather;
  try {
    raw = (await res.json()) as OwWeather;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid weather response." }, { status: 502 });
  }

  if (!res.ok) {
    logger.warn("api/weather", "openweather error", { status: res.status });
    return NextResponse.json(
      { ok: false, error: "Weather provider returned an error.", status: res.status },
      { status: res.status >= 500 ? 502 : res.status },
    );
  }

  const w0 = raw.weather?.[0];
  const body: WeatherPayload = {
    ok: true,
    locationLabel: raw.name?.trim() || q.split(",")[0] || q,
    tempC: Math.round((raw.main?.temp ?? 0) * 10) / 10,
    feelsLikeC: Math.round((raw.main?.feels_like ?? raw.main?.temp ?? 0) * 10) / 10,
    description: titleCaseDescription(w0?.description ?? "—"),
    iconCode: w0?.icon ?? "01d",
    humidity: raw.main?.humidity ?? null,
    windMps: raw.wind?.speed ?? null,
    cached: false,
    weatherSource,
  };

  const svc = createServiceClient();
  if (svc) {
    await writeCachedJson(key, body);
  }

  return NextResponse.json(body);
}
