"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MasterFriend, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import AvatarFallback from "@/components/shared/AvatarFallback";
import { logger } from "@/lib/logger";
import ProfileCompletionForm from "@/components/shared/ProfileCompletionForm";

interface HeroRegistrationProps {
  initialOpen: MasterFriend[];
  initialJoined: Profile[];
  pendingMasterFriendId: string | null;
  pendingFullName: string | null;
  needsProfile: boolean;
}

export default function HeroRegistration({
  initialOpen,
  initialJoined,
  pendingMasterFriendId,
  pendingFullName,
  needsProfile,
}: HeroRegistrationProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<MasterFriend | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<Profile[]>(initialJoined);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel("profiles-phase1")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Profile;
          setJoined((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => (a.join_order ?? 0) - (b.join_order ?? 0),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const openBuddies = useMemo(() => {
    return initialOpen.filter((b) => {
      if (b.is_registered) return false;
      const nameTaken = joined.some(
        (p) =>
          p.full_name.trim().toLowerCase() ===
          b.display_name.trim().toLowerCase(),
      );
      return !nameTaken;
    });
  }, [initialOpen, joined]);

  async function sendMagicLink() {
    if (!picked || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirect = `${origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirect,
        data: {
          master_friend_id: picked.id,
          full_name: picked.display_name,
        },
      },
    });
    setBusy(false);
    if (error) {
      logger.error("HeroRegistration", "signInWithOtp failed", {
        message: error.message,
      });
      setMessage("Could not send login email. Please try again.");
      return;
    }
    setMessage("Check your inbox for the BuddyNagar login link.");
    setOpen(false);
  }

  return (
    <section
      id="hero"
      className="scroll-mt-20 border-b border-border bg-secondary/40 py-12 px-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="text-center md:text-left">
          <p className="font-display text-2xl font-semibold md:text-3xl">
            Find your name. Join the gang.
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            BuddyNagar is a private corner for the Kadapa buddies — memories,
            news, and celebrations in one scroll.
          </p>
        </div>

        {needsProfile && pendingMasterFriendId && (
          <ProfileCompletionForm
            masterFriendId={pendingMasterFriendId}
            defaultFullName={pendingFullName ?? ""}
          />
        )}

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <h2 className="font-display text-lg font-semibold">
                Names on the wall
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap your name to get a magic login link.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {openBuddies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Everyone here has joined — welcome back, gang.
                  </p>
                ) : (
                  openBuddies.map((b) => (
                    <Button
                      key={b.id}
                      type="button"
                      variant="outline"
                      className="text-base"
                      style={{
                        transform: `rotate(${(b.id.charCodeAt(0) % 7) - 3}deg)`,
                      }}
                      onClick={() => {
                        setPicked(b);
                        setEmail("");
                        setMessage(null);
                        setOpen(true);
                      }}
                    >
                      {b.display_name}
                    </Button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-display text-lg font-semibold">
                Who joined
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                New members appear here in real time.
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {joined.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    Waiting for the first buddy to register.
                  </li>
                ) : (
                  joined.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <AvatarFallback
                        name={p.full_name}
                        className="h-11 w-11 shrink-0 text-sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.full_name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {p.city ? `${p.city}` : "Kadapa gang"}
                          {p.join_order != null ? ` · #${p.join_order}` : ""}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {message ? (
          <p className="text-center text-sm text-muted-foreground md:text-left">
            {message}
          </p>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join as {picked?.display_name}</DialogTitle>
            <DialogDescription>
              Enter your email and we will send a magic link — no password to
              remember.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={busy || !email.trim()}
              onClick={() => void sendMagicLink()}
            >
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
