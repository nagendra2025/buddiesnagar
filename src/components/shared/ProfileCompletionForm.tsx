"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

interface ProfileCompletionFormProps {
  masterFriendId: string;
  defaultFullName: string;
}

export default function ProfileCompletionForm({
  masterFriendId,
  defaultFullName,
}: ProfileCompletionFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const m =
      month.trim() === "" ? null : Number.parseInt(month, 10);
    const d = day.trim() === "" ? null : Number.parseInt(day, 10);
    if (m !== null && (Number.isNaN(m) || m < 1 || m > 12)) {
      setError("Birthday month must be 1–12");
      setBusy(false);
      return;
    }
    if (d !== null && (Number.isNaN(d) || d < 1 || d > 31)) {
      setError("Birthday day must be 1–31");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterFriendId,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
          birthdayMonth: m,
          birthdayDay: d,
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

  return (
    <Card className="border-primary/40 bg-card">
      <CardHeader>
        <CardTitle className="font-display text-xl">
          Finish your BuddyNagar profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-2">
            <Label htmlFor="pc-name">Full name</Label>
            <Input
              id="pc-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pc-phone">Phone (optional)</Label>
              <Input
                id="pc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-city">City (optional)</Label>
              <Input
                id="pc-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pc-bio">What I do now (max 120 chars)</Label>
            <Input
              id="pc-bio"
              maxLength={120}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pc-bm">Birthday month (optional)</Label>
              <Input
                id="pc-bm"
                inputMode="numeric"
                placeholder="1–12"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pc-bd">Birthday day (optional)</Label>
              <Input
                id="pc-bd"
                inputMode="numeric"
                placeholder="1–31"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !fullName.trim()}>
            {busy ? "Saving…" : "Save and enter BuddyNagar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
