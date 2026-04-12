"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AvatarFallback from "@/components/shared/AvatarFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const INDIA_TIMEZONES = [{ value: "Asia/Kolkata", label: "India Standard Time (Asia/Kolkata)" }] as const;
const USA_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (America/New_York)" },
  { value: "America/Detroit", label: "Eastern - Detroit (America/Detroit)" },
  { value: "America/Chicago", label: "Central (America/Chicago)" },
  { value: "America/Denver", label: "Mountain (America/Denver)" },
  { value: "America/Phoenix", label: "Arizona (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
] as const;
const CANADA_TIMEZONES = [
  { value: "America/Toronto", label: "Toronto (America/Toronto)" },
  { value: "America/Vancouver", label: "Vancouver (America/Vancouver)" },
  { value: "America/Edmonton", label: "Edmonton (America/Edmonton)" },
  { value: "America/Winnipeg", label: "Winnipeg (America/Winnipeg)" },
  { value: "America/Halifax", label: "Halifax (America/Halifax)" },
  { value: "America/St_Johns", label: "St. John's (America/St_Johns)" },
] as const;

const ALLOWED_TIMEZONE_VALUES: ReadonlySet<string> = new Set<string>(
  [...INDIA_TIMEZONES, ...USA_TIMEZONES, ...CANADA_TIMEZONES].map((z) => z.value),
);

function compareProfilesAlphabetically(a: Profile, b: Profile): number {
  const byName = a.full_name.localeCompare(b.full_name, undefined, {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;
  return (a.join_order ?? 0) - (b.join_order ?? 0);
}

export default function ProfilesSection({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const sorted = [...profiles].sort(compareProfilesAlphabetically);
  const [selfOverride, setSelfOverride] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [timezone, setTimezone] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useMemo(() => {
    const base = sorted.find((p) => p.id === currentUserId) ?? null;
    if (!base) return null;
    if (!selfOverride || selfOverride.id !== base.id) return base;
    return { ...base, ...selfOverride };
  }, [sorted, currentUserId, selfOverride]);

  async function openEditForSelf() {
    if (!me) return;
    let latest = me;
    if (currentUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .maybeSingle();
      if (data) latest = data as Profile;
    }

    setEditing(latest);
    setFirstName((latest.first_name ?? latest.full_name.split(" ")[0] ?? "").trim());
    setLastName(
      (latest.last_name ??
        latest.full_name
          .split(" ")
          .slice(1)
          .join(" ") ??
        "").trim(),
    );
    setNickname((latest.nickname ?? "").trim());
    setCity((latest.city ?? "").trim());
    setPhone((latest.phone ?? "").trim());
    setBio((latest.bio ?? "").trim());
    setTimezone((latest.timezone ?? "").trim());
    setMonth(latest.birthday_month ? String(latest.birthday_month) : "");
    setDay(latest.birthday_day ? String(latest.birthday_day) : "");
    setYear(latest.birthday_year ? String(latest.birthday_year) : "");
    setError(null);
  }

  async function saveProfile() {
    if (!editing) return;
    setBusy(true);
    setError(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    const nick = nickname.trim();
    const tz = timezone.trim();
    const m = Number.parseInt(month, 10);
    const d = Number.parseInt(day, 10);
    const y = Number.parseInt(year, 10);

    if (!fn || !ln || !nick) {
      setError("First name, last name, and nickname are required.");
      setBusy(false);
      return;
    }
    if (!city.trim() || !phone.trim() || !bio.trim()) {
      setError("Location, phone, and What I do now are required.");
      setBusy(false);
      return;
    }
    if (!tz || !ALLOWED_TIMEZONE_VALUES.has(tz)) {
      setError("Please select a valid timezone.");
      setBusy(false);
      return;
    }
    if (Number.isNaN(m) || m < 1 || m > 12) {
      setError("Birth month must be 1-12.");
      setBusy(false);
      return;
    }
    if (Number.isNaN(d) || d < 1 || d > 31) {
      setError("Birth day must be 1-31.");
      setBusy(false);
      return;
    }
    if (Number.isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) {
      setError(`Birth year must be 1900-${new Date().getFullYear() + 1}.`);
      setBusy(false);
      return;
    }
    const cal = new Date(y, m - 1, d);
    if (cal.getFullYear() !== y || cal.getMonth() !== m - 1 || cal.getDate() !== d) {
      setError("That date is not valid on the calendar.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fn,
          lastName: ln,
          nickname: nick,
          phone: phone.trim(),
          city: city.trim(),
          bio: bio.trim(),
          timezone: tz,
          birthdayMonth: m,
          birthdayDay: d,
          birthdayYear: y,
        }),
      });
      const data = (await res.json()) as { error?: string; profile?: Profile };
      if (!res.ok) {
        setError(data.error ?? "Could not update profile.");
        setBusy(false);
        return;
      }
      if (data.profile) {
        setSelfOverride(data.profile);
      } else if (editing) {
        setSelfOverride({
          ...editing,
          first_name: fn,
          last_name: ln,
          full_name: `${fn} ${ln}`,
          nickname: nick,
          phone: phone.trim(),
          city: city.trim(),
          bio: bio.trim(),
          timezone: tz,
          birthday_month: m,
          birthday_day: d,
          birthday_year: y,
        });
      }
      setEditing(null);
      router.refresh();
    } catch (e) {
      logger.error("ProfilesSection", "saveProfile failed", {
        message: e instanceof Error ? e.message : "unknown",
      });
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  return (
    <section
      id="gang"
      className="scroll-mt-20 border-b border-border py-12 px-4"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Our gang
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Alphabetical by name. Each card still shows who joined when; the hero
          “Who joined” list stays in arrival order.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.length === 0 ? (
            <p className="col-span-full text-center text-muted-foreground">
              No profiles yet — be the first from the wall.
            </p>
          ) : (
            sorted.map((p) => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  {p.id === currentUserId ? (
                    <button
                      type="button"
                      aria-label="Open my profile"
                      title="Edit my profile"
                      className="group relative rounded-full cursor-pointer transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      onClick={() => void openEditForSelf()}
                    >
                      <span
                        className="absolute -inset-1 rounded-full border border-primary/45 opacity-80 transition-opacity duration-200 group-hover:opacity-100"
                        aria-hidden
                      />
                      <AvatarFallback
                        name={p.full_name}
                        className="h-14 w-14 text-base ring-2 ring-primary/40 ring-offset-2 ring-offset-background transition-shadow duration-200 group-hover:shadow-[0_0_0_4px_rgba(34,197,94,0.15)]"
                      />
                    </button>
                  ) : (
                    <AvatarFallback
                      name={p.full_name}
                      className="h-14 w-14 text-base"
                    />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">
                      {p.full_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {p.city ?? "Kadapa connection"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.join_order != null ? (
                    <Badge variant="secondary">#{p.join_order} to join</Badge>
                  ) : null}
                  {p.bio ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {p.bio}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent
          className={cn(
            "flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-4 pt-12",
            "left-1/2 top-[2%] -translate-x-1/2 translate-y-0 sm:top-1/2 sm:-translate-y-1/2",
            "sm:max-h-[min(90dvh,44rem)] sm:max-w-lg sm:w-[calc(100%-2rem)] sm:gap-4 sm:p-6 sm:pt-6",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1.5 pr-7 text-left sm:pr-8">
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update your details. This opens only from your own initials in Our gang.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <div className="grid gap-3 sm:gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="ep-first">First name</Label>
                  <Input
                    id="ep-first"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="ep-last">Last name</Label>
                  <Input
                    id="ep-last"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ep-nick">Nickname</Label>
                <Input
                  id="ep-nick"
                  className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ep-bm">Birth month</Label>
                  <Input
                    id="ep-bm"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    inputMode="numeric"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ep-bd">Birth day</Label>
                  <Input
                    id="ep-bd"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    inputMode="numeric"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ep-by">Birth year</Label>
                  <Input
                    id="ep-by"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    inputMode="numeric"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="ep-city">Location</Label>
                  <Input
                    id="ep-city"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="ep-phone">Phone</Label>
                  <Input
                    id="ep-phone"
                    className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="ep-timezone">Timezone</Label>
                <select
                  id="ep-timezone"
                  className="flex min-h-11 w-full min-w-0 touch-manipulation rounded-lg border border-input bg-background px-3 text-base sm:min-h-10 sm:text-sm"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  required
                >
                  <option value="">Select timezone</option>
                  <optgroup label="India">
                    {INDIA_TIMEZONES.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="United States">
                    {USA_TIMEZONES.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Canada">
                    {CANADA_TIMEZONES.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ep-bio">What I do now (max 120)</Label>
                <Input
                  id="ep-bio"
                  className="min-h-11 text-base sm:min-h-10 sm:text-sm"
                  maxLength={120}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          </div>

          <div className="mt-3 flex shrink-0 flex-col gap-2 border-t border-border/70 pt-3 sm:mt-0 sm:flex-row sm:justify-end sm:border-t-0 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation sm:min-h-10 sm:w-auto"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full touch-manipulation sm:min-h-10 sm:w-auto"
              disabled={busy}
              onClick={() => void saveProfile()}
            >
              {busy ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
