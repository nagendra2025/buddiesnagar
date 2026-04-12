"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppWindow, CloudSun, Gamepad2, Trophy } from "lucide-react";
import { logger } from "@/lib/logger";

type WeatherOk = {
  ok: true;
  locationLabel: string;
  tempC: number;
  feelsLikeC: number;
  description: string;
  iconCode: string;
  humidity: number | null;
  windMps: number | null;
  cached?: boolean;
  /** Set by `/api/weather` when the query came from the signed-in user’s profile city. */
  weatherSource?: "profile" | "default";
};

type WeatherErr = {
  ok: false;
  missingApiKey?: boolean;
  message?: string;
  error?: string;
};

type CricketMatch = {
  id: string;
  name: string;
  status: string;
  matchType: string | null;
  team1: string | null;
  team2: string | null;
};

type CricketOk = {
  ok: true;
  matches: CricketMatch[];
  cached?: boolean;
};

type CricketErr = {
  ok: false;
  missingApiKey?: boolean;
  message?: string;
  error?: string;
  matches?: CricketMatch[];
};

const DEFAULT_LICHESS_MATE2 = "Kbg4l";
const DEFAULT_LICHESS_MATE3 = "3HyMN";

const whofitsUrl =
  typeof process.env.NEXT_PUBLIC_WHOFITS_URL === "string"
    ? process.env.NEXT_PUBLIC_WHOFITS_URL.trim()
    : "";

function lichessPuzzleIdFromEnv(name: string, fallback: string): string {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return fallback;
}

const lichessMate2Id = lichessPuzzleIdFromEnv(
  "NEXT_PUBLIC_LICHESS_PUZZLE_MATE2",
  DEFAULT_LICHESS_MATE2,
);
const lichessMate3Id = lichessPuzzleIdFromEnv(
  "NEXT_PUBLIC_LICHESS_PUZZLE_MATE3",
  DEFAULT_LICHESS_MATE3,
);

function lichessPuzzleFrameSrc(puzzleId: string): string {
  const q = new URLSearchParams({
    puzzle: puzzleId,
    theme: "blue",
    bg: "dark",
    pieceSet: "cburnett",
  });
  return `https://lichess.org/training/frame?${q.toString()}`;
}

function lichessPuzzlePageUrl(puzzleId: string): string {
  return `https://lichess.org/training/${encodeURIComponent(puzzleId)}`;
}

/** Tight crop: wrapper overflow-hidden clips Lichess’s padding under “Black to play” while keeping that line on-screen. */
const LICHESS_PUZZLE_FRAME_CLASS =
  "block h-[calc(232px-1mm)] w-full max-w-full border-0 sm:h-[calc(252px-1mm)] md:h-[calc(272px-1mm)]";

export default function Phase3PlaygroundSection() {
  const [weather, setWeather] = useState<WeatherOk | WeatherErr | null>(null);
  const [cricket, setCricket] = useState<CricketOk | CricketErr | null>(null);
  const [wLoading, setWLoading] = useState(true);
  const [cLoading, setCLoading] = useState(true);

  const loadWeather = useCallback(async () => {
    setWLoading(true);
    try {
      const res = await fetch("/api/weather", { cache: "no-store" });
      const data = (await res.json()) as WeatherOk | WeatherErr;
      setWeather(data);
    } catch (e) {
      logger.warn("Phase3Playground", "weather fetch failed", {
        message: e instanceof Error ? e.message : String(e),
      });
      setWeather({ ok: false, error: "Could not load weather." });
    } finally {
      setWLoading(false);
    }
  }, []);

  const loadCricket = useCallback(async () => {
    setCLoading(true);
    try {
      const res = await fetch("/api/cricket", { cache: "no-store" });
      const data = (await res.json()) as CricketOk | CricketErr;
      setCricket(data);
    } catch (e) {
      logger.warn("Phase3Playground", "cricket fetch failed", {
        message: e instanceof Error ? e.message : String(e),
      });
      setCricket({ ok: false, error: "Could not load cricket.", matches: [] });
    } finally {
      setCLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeather();
    void loadCricket();
  }, [loadWeather, loadCricket]);

  const weatherIconSrc = (code: string) =>
    `https://openweathermap.org/img/wn/${code}@2x.png`;

  return (
    <section id="playground" className="scroll-mt-20 border-b border-border py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Playground</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Games, local weather, and live cricket — Phase 3 extras for the crew.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="border-primary/15">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Gamepad2 className="h-5 w-5 text-primary" aria-hidden />
                  Games
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                <p className="text-sm font-medium text-foreground">Lichess puzzles</p>
                <p className="text-xs text-muted-foreground">
                  Two curated trainers side by side — mate in 2 and mate in 3 from Lichess.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Mate in 2 — elite
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ~2420 puzzle rating on Lichess: forcing checks, hidden geometry, and zero room for
                      hesitation once you commit.
                    </p>
                    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-zinc-950">
                      <iframe
                        title={`Lichess puzzle ${lichessMate2Id} (mate in 2)`}
                        src={lichessPuzzleFrameSrc(lichessMate2Id)}
                        className={LICHESS_PUZZLE_FRAME_CLASS}
                        allowFullScreen
                      />
                    </div>
                    <a
                      href={lichessPuzzlePageUrl(lichessMate2Id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open full puzzle on Lichess (new tab)
                    </a>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Mate in 3 — master blend
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sacrifice, king hunt, and a classic attacking finish — three precise moves only.
                      Rated tough on Lichess with master-level themes.
                    </p>
                    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-zinc-950">
                      <iframe
                        title={`Lichess puzzle ${lichessMate3Id} (mate in 3)`}
                        src={lichessPuzzleFrameSrc(lichessMate3Id)}
                        className={LICHESS_PUZZLE_FRAME_CLASS}
                        allowFullScreen
                      />
                    </div>
                    <a
                      href={lichessPuzzlePageUrl(lichessMate3Id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open full puzzle on Lichess (new tab)
                    </a>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-violet-500/25">
              <CardHeader className="gap-1 px-4 pb-1.5 pt-3">
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <AppWindow className="h-5 w-5 text-violet-500" aria-hidden />
                  Browser games
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="w-full min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground">WhoFits — deduction lounge</p>
                    <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-2 sm:text-[15px] sm:leading-relaxed">
                      Social deduction: secret roles, stacking clues, and group debate until the truth
                      surfaces. Faster than a full board game, deeper than small talk — good when Kadapa
                      buddies want focus in a dedicated tab (audio and timers stay off the main page).
                    </p>
                  </div>
                  {whofitsUrl ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">Room link</p>
                        <p className="mt-1 break-all rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[11px] leading-snug text-foreground sm:text-xs">
                          {whofitsUrl}
                        </p>
                      </div>
                      <a
                        href={whofitsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:self-center sm:px-4 sm:text-sm"
                      >
                        Open WhoFits
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_WHOFITS_URL</code> to your full
                      WhoFits room URL. We will show it here and open it in a new tab — nothing is embedded on
                      BuddyNagar.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Card className="border-sky-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <CloudSun className="h-5 w-5 text-sky-500" aria-hidden />
                  Weather
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadWeather()}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {wLoading ? (
                  <Skeleton className="h-28 w-full" />
                ) : weather && weather.ok ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <Image
                      src={weatherIconSrc(weather.iconCode)}
                      alt=""
                      width={80}
                      height={80}
                      className="h-20 w-20"
                      unoptimized
                    />
                    <div>
                      <p className="text-3xl font-semibold tabular-nums">
                        {weather.tempC}°C
                        <span className="ml-2 text-base font-normal text-muted-foreground">
                          feels {weather.feelsLikeC}°C
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">{weather.description}</p>
                      <p className="mt-1 text-sm font-medium">{weather.locationLabel}</p>
                      {weather.weatherSource === "profile" && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Using your profile location (city and timezone).
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {weather.humidity != null && <>Humidity {weather.humidity}% · </>}
                        {weather.windMps != null && <>Wind {weather.windMps} m/s · </>}
                        {weather.cached ? "Cached" : "Live"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(weather as WeatherErr)?.missingApiKey
                      ? (weather as WeatherErr).message
                      : (weather as WeatherErr)?.error ?? "Weather unavailable."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Trophy className="h-5 w-5 text-emerald-600" aria-hidden />
                  Cricket
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadCricket()}>
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {cLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : cricket && cricket.ok ? (
                  cricket.matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No current matches from the feed.</p>
                  ) : (
                    <ul className="max-h-[calc(var(--spacing)*120-0.5cm)] space-y-3 overflow-y-auto pr-1 text-sm">
                      {cricket.matches.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-md border border-border/80 bg-muted/20 px-3 py-2"
                        >
                          <p className="font-medium leading-snug">{m.name}</p>
                          {(m.team1 || m.team2) && (
                            <p className="text-xs text-muted-foreground">
                              {[m.team1, m.team2].filter(Boolean).join(" vs ")}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">{m.status}</p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(cricket as CricketErr)?.missingApiKey
                      ? (cricket as CricketErr).message
                      : (cricket as CricketErr)?.error ?? "Cricket feed unavailable."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
