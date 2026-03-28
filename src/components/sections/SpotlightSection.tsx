import { format } from "date-fns";
import type { Profile, Wish } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
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

export default function SpotlightSection({
  profiles,
  wishes,
}: {
  profiles: Profile[];
  wishes: Wish[];
}) {
  const today = new Date();
  const todayLabel = format(today, "EEEE, MMMM d");

  const birthdays = profiles.filter(
    (p) =>
      p.birthday_month != null &&
      p.birthday_day != null &&
      sameMonthDay(today, p.birthday_month, p.birthday_day),
  );

  const festival = wishes.find((w) => wishMatchesToday(w, today));

  let title: string;
  let body: string;
  let emoji = "";
  let bg = "from-secondary to-background";
  let birthdayPeople: Profile[] = [];

  if (birthdays.length > 0) {
    birthdayPeople = birthdays;
    const names = birthdays.map((b) => b.full_name).join(", ");
    title = `Happy birthday, ${names}!`;
    body = "The Kadapa gang is cheering for you today.";
    emoji = "🎂";
    bg = "from-amber-100 to-amber-50";
  } else if (festival) {
    title = festival.title;
    body = festival.message ?? "Warm wishes to every buddy today.";
    emoji = festival.icon_emoji ?? "✨";
    bg = "from-emerald-50 to-background";
  } else {
    title = "All clear today";
    body =
      "No festival on the calendar — enjoy a calm day together. Check back for the next big celebration.";
    emoji = "🏘️";
    bg = "from-teal-50 to-background";
  }

  return (
    <section
      id="spotlight"
      className="scroll-mt-20 border-b border-border py-12 px-4"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Today&apos;s spotlight
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{todayLabel}</p>
        <Card
          className={`mt-6 overflow-hidden border-0 bg-gradient-to-br shadow-sm ${bg}`}
        >
          <CardContent className="space-y-4 p-6 md:p-8">
            <p className="text-4xl" aria-hidden>
              {emoji}
            </p>
            <h3 className="font-display text-xl font-semibold md:text-2xl">
              {title}
            </h3>
            <p className="max-w-2xl text-base text-muted-foreground">{body}</p>
            {birthdayPeople.length > 0 ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {birthdayPeople.map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <AvatarFallback
                      name={b.full_name}
                      className="h-12 w-12 text-sm"
                    />
                    <span className="text-sm font-medium">{b.full_name}</span>
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
