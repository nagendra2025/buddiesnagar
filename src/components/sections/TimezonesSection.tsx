"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type ZoneClock = {
  label: string;
  tz: string;
  short: string;
};

const CLOCKS: ZoneClock[] = [
  { label: "Austin", tz: "America/Chicago", short: "CT" },
  { label: "Chicago", tz: "America/Chicago", short: "CT" },
  { label: "Dallas", tz: "America/Chicago", short: "CT" },
  { label: "India", tz: "Asia/Kolkata", short: "IST" },
  { label: "Los Angeles", tz: "America/Los_Angeles", short: "PT" },
  { label: "Toronto", tz: "America/Toronto", short: "ET" },
  { label: "Vancouver", tz: "America/Vancouver", short: "PT" },
];

function zoneParts(now: Date, timeZone: string): {
  hh: number;
  mm: number;
  display: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const pick = (type: "hour" | "minute") =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hh = pick("hour");
  const mm = pick("minute");
  return {
    hh,
    mm,
    display: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
  };
}

export default function TimezonesSection() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const t0 = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 10000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, []);

  const clocks = useMemo(
    () =>
      CLOCKS.map((item) => {
        if (!now) {
          return { ...item, hh: 10, mm: 10, display: "--:--" };
        }
        const p = zoneParts(now, item.tz);
        return { ...item, ...p };
      }),
    [now],
  );

  return (
    <section id="timezones" className="scroll-mt-20 border-b border-border py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Timezones</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Live city times for buddies across regions.
        </p>

        <Card className="mt-6 border-amber-200/20 bg-linear-to-r from-stone-900 via-stone-950 to-stone-900 text-amber-50">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
              {clocks.map((c, idx) => (
                <div
                  key={c.label}
                  className="relative flex items-center justify-center px-3 py-5 sm:px-4"
                >
                  {idx > 0 ? (
                    <span className="absolute bottom-4 left-0 top-4 hidden w-px bg-amber-200/20 lg:block" aria-hidden />
                  ) : null}
                  {idx >= 2 ? (
                    <span className="absolute left-4 right-4 top-0 h-px bg-amber-200/15 sm:left-5 sm:right-5 lg:hidden" aria-hidden />
                  ) : null}
                  <div className="min-w-0 text-center">
                    <p className="truncate text-sm font-semibold tracking-wide text-amber-100">{c.label}</p>
                    <p className="mt-1 font-mono text-xl tracking-wide text-amber-50">
                      {c.display}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-amber-200/70">{c.short}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
