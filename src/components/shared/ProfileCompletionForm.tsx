"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

function splitDefaultName(displayName: string): { first: string; last: string } {
  const t = displayName.trim();
  if (!t) return { first: "", last: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { first: t, last: "" };
  return { first: t.slice(0, i).trim(), last: t.slice(i + 1).trim() };
}

interface ProfileCompletionFormProps {
  masterFriendId: string;
  /** From wall pick — used only to pre-fill first/last name fields. */
  defaultFullName: string;
  /** Login email from auth (read-only). */
  accountEmail: string;
}

export default function ProfileCompletionForm({
  masterFriendId,
  defaultFullName,
  accountEmail,
}: ProfileCompletionFormProps) {
  const defaults = useMemo(
    () => splitDefaultName(defaultFullName),
    [defaultFullName],
  );
  const router = useRouter();
  const [firstName, setFirstName] = useState(defaults.first);
  const [lastName, setLastName] = useState(defaults.last);
  const [nickname, setNickname] = useState(defaults.first || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    const nick = nickname.trim();
    if (!fn || !ln || !nick) {
      setError("First name, last name, and nickname are required.");
      setBusy(false);
      return;
    }

    const m = Number.parseInt(month, 10);
    const d = Number.parseInt(day, 10);
    const y = Number.parseInt(year, 10);
    if (Number.isNaN(m) || m < 1 || m > 12) {
      setError("Birth month must be 1–12.");
      setBusy(false);
      return;
    }
    if (Number.isNaN(d) || d < 1 || d > 31) {
      setError("Birth day must be 1–31.");
      setBusy(false);
      return;
    }
    if (Number.isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) {
      setError(`Birth year must be 1900–${new Date().getFullYear() + 1}.`);
      setBusy(false);
      return;
    }
    const cal = new Date(y, m - 1, d);
    if (
      cal.getFullYear() !== y ||
      cal.getMonth() !== m - 1 ||
      cal.getDate() !== d
    ) {
      setError("That date is not valid on the calendar.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterFriendId,
          firstName: fn,
          lastName: ln,
          nickname: nick,
          phone: phone.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
          birthdayMonth: m,
          birthdayDay: d,
          birthdayYear: y,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (err) {
      logger.error("ProfileCompletionForm", "submit failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    nickname.trim() &&
    month.trim() &&
    day.trim() &&
    year.trim();

  return (
    <Card className="border-primary/40 bg-card">
      <CardHeader>
        <CardTitle className="font-display text-xl">
          Finish your BuddyNagar profile
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          You already chose your <strong>email and password</strong> when you
          opened your account. Confirm the rest below — only{" "}
          <strong>location</strong> is optional.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-2">
            <Label htmlFor="pc-email">Email (login ID)</Label>
            <Input
              id="pc-email"
              type="email"
              value={accountEmail}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pc-first">First name</Label>
              <Input
                id="pc-first"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-last">Last name</Label>
              <Input
                id="pc-last"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pc-nick">Nickname</Label>
            <Input
              id="pc-nick"
              autoComplete="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pc-bm">Birth month</Label>
              <Input
                id="pc-bm"
                inputMode="numeric"
                placeholder="1–12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-bd">Birth day</Label>
              <Input
                id="pc-bd"
                inputMode="numeric"
                placeholder="1–31"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-by">Birth year</Label>
              <Input
                id="pc-by"
                inputMode="numeric"
                placeholder="e.g. 1990"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pc-city">Location (optional)</Label>
              <Input
                id="pc-city"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-phone">Phone (optional)</Label>
              <Input
                id="pc-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pc-bio">What I do now (optional, max 120)</Label>
            <Input
              id="pc-bio"
              maxLength={120}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "Saving…" : "Save and enter BuddyNagar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
