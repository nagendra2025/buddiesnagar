import { format } from "date-fns";
import type { Profile, Wish } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AvatarFallback from "@/components/shared/AvatarFallback";

function sameMonthDay(d: Date, month: number, day: number) {
  return d.getMonth() + 1 === month && d.getDate() === day;
}

function wishMatchesToday(w: Wish, today: Date): boolean {
  if (!w.wish_date || !w.is_active) return false;
  const wd = new Date(w.wish_date + "T12:00:00");
  if (w.is_recurring) {
    return wd.getMonth() === today.getMonth() && wd.getDate() === today.getDate();
  }
  return (
    wd.getFullYear() === today.getFullYear() &&
    wd.getMonth() === today.getMonth() &&
    wd.getDate() === today.getDate()
  );
}

function profileDisplayName(p: Profile): string {
  const n = p.nickname?.trim();
  if (n) return n;
  return p.full_name;
}

function typeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t === "festival") return "Festival";
  if (t === "national") return "National day";
  if (t === "special" || t === "special_day") return "Special day";
  if (t === "birthday") return "Birthday note";
  return type.replace(/_/g, " ");
}

export default function SpotlightSection({
  profiles,
  wishes,
}: {
  profiles: Profile[];
  wishes: Wish[];
}) {
  const today = new Date();
  const todayLabel = format(today, "EEEE, MMMM d, yyyy");

  const birthdays = profiles.filter(
    (p) =>
      p.birthday_month != null &&
      p.birthday_day != null &&
      sameMonthDay(today, p.birthday_month, p.birthday_day),
  );

  const festivalsToday = wishes.filter((w) => wishMatchesToday(w, today));

  const hasBirthdays = birthdays.length > 0;
  const hasFestivals = festivalsToday.length > 0;
  const isQuiet = !hasBirthdays && !hasFestivals;

  return (
    <section
      id="spotlight"
      className="scroll-mt-20 border-b border-border py-12 px-4"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Today&apos;s spotlight
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {todayLabel}
          <span className="ml-2 text-xs">
            (Everything below stays up for the whole day in your timezone.)
          </span>
        </p>

        <Card
          className={`mt-6 overflow-hidden border shadow-md ${
            isQuiet
              ? "border-border bg-gradient-to-br from-slate-50 to-background"
              : hasBirthdays && hasFestivals
                ? "border-amber-200/60 bg-gradient-to-br from-amber-50/90 via-violet-50/50 to-emerald-50/70"
                : hasBirthdays
                  ? "border-rose-200/50 bg-gradient-to-br from-rose-50 via-amber-50/80 to-orange-50/60"
                  : "border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 to-teal-50/50"
          }`}
        >
          <CardContent className="space-y-6 p-6 md:p-8">
            {isQuiet ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                <span className="text-4xl" aria-hidden>
                  🏡
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold md:text-2xl">
                    All clear today
                  </h3>
                  <p className="mt-2 max-w-2xl text-muted-foreground">
                    No buddy birthdays and no festival or special-day entries on
                    the calendar for today. Add dated wishes in Supabase{" "}
                    <code className="rounded bg-muted px-1 text-xs">wishes</code>{" "}
                    (recurring or one-off) to light up this card — or enjoy a
                    calm day together.
                  </p>
                </div>
              </div>
            ) : null}

            {hasBirthdays ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-rose-200/40 bg-gradient-to-br from-rose-100/90 via-amber-50/95 to-white p-5 shadow-inner md:p-6"
                role="region"
                aria-label="Birthdays today"
              >
                <div
                  className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-[0.12]"
                  aria-hidden
                >
                  🎂
                </div>
                <div className="relative flex flex-wrap items-center gap-2">
                  <Badge className="bg-rose-600 text-white hover:bg-rose-600">
                    Birthday
                  </Badge>
                  <span className="text-2xl" aria-hidden>
                    🎈✨
                  </span>
                </div>
                <h3 className="relative mt-3 font-display text-xl font-semibold text-rose-950 md:text-2xl">
                  {birthdays.length === 1
                    ? `Happy birthday, ${profileDisplayName(birthdays[0]!)}!`
                    : `Happy birthday to our ${birthdays.length} stars today!`}
                </h3>
                <p className="relative mt-2 max-w-2xl text-rose-900/85">
                  The Kadapa gang sends you love, laughter, and the best wishes
                  for the year ahead. Make it a great one!
                </p>
                <ul className="relative mt-5 flex flex-wrap gap-4">
                  {birthdays.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm"
                    >
                      <AvatarFallback
                        name={b.full_name}
                        className="h-12 w-12 shrink-0 text-sm ring-2 ring-rose-200"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {profileDisplayName(b)}
                        </p>
                        {b.nickname?.trim() &&
                        b.nickname.trim() !== b.full_name.trim() ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {b.full_name}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasFestivals ? (
              <div
                className="space-y-4"
                role="region"
                aria-label="Festivals and special days"
              >
                {hasBirthdays ? (
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Also on the calendar
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                {festivalsToday.map((w) => (
                  <div
                    key={w.id}
                    className="flex flex-col gap-3 rounded-2xl border border-emerald-200/50 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-stretch sm:gap-5 md:p-6"
                    style={
                      w.banner_color
                        ? {
                            borderLeftWidth: 4,
                            borderLeftColor: w.banner_color,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-3xl shadow-inner"
                      aria-hidden
                    >
                      {w.icon_emoji ?? "✨"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(w.type)}
                        </Badge>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold md:text-xl">
                        {w.title}
                      </h3>
                      {w.message ? (
                        <p className="mt-2 text-muted-foreground">{w.message}</p>
                      ) : (
                        <p className="mt-2 text-sm italic text-muted-foreground">
                          Warm wishes to every buddy today.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
