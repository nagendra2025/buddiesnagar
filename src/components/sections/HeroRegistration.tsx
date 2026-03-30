"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { userFacingAuthEmailError } from "@/lib/authEmailErrors";
import {
  readPendingBuddy,
  savePendingBuddy,
} from "@/lib/pendingBuddyRegistration";
import ProfileCompletionForm from "@/components/shared/ProfileCompletionForm";

interface HeroRegistrationProps {
  initialOpen: MasterFriend[];
  initialJoined: Profile[];
  pendingMasterFriendId: string | null;
  pendingFullName: string | null;
  needsProfile: boolean;
  isSignedIn?: boolean;
  pendingAccountEmail?: string | null;
}

export default function HeroRegistration({
  initialOpen,
  initialJoined,
  pendingMasterFriendId,
  pendingFullName,
  needsProfile,
  isSignedIn = false,
  pendingAccountEmail = null,
}: HeroRegistrationProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<MasterFriend | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<Profile[]>(initialJoined);
  const [returnEmail, setReturnEmail] = useState("");
  const [returnPassword, setReturnPassword] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [showReturnMagicLink, setShowReturnMagicLink] = useState(false);
  const [recoveredBuddy, setRecoveredBuddy] = useState<{
    id: string;
    fullName: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    if (!needsProfile) {
      queueMicrotask(() => {
        if (active) setRecoveredBuddy(null);
      });
      return () => {
        active = false;
      };
    }
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!active || !u?.email) return;
      const stored = readPendingBuddy();
      if (!stored || stored.email !== u.email.trim().toLowerCase()) return;
      setRecoveredBuddy({
        id: stored.master_friend_id,
        fullName: stored.full_name,
      });
    });
    return () => {
      active = false;
    };
  }, [needsProfile, supabase]);

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

  function resetJoinDialog() {
    setEmail("");
  }

  async function sendJoinMagicLink() {
    if (!picked || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirect = `${origin}/auth/callback`;
    const emailNorm = email.trim().toLowerCase();
    savePendingBuddy({
      master_friend_id: picked.id,
      full_name: picked.display_name,
      email: emailNorm,
    });
    const { error } = await supabase.auth.signInWithOtp({
      email: emailNorm,
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
        code: error.code,
      });
      setMessage(userFacingAuthEmailError(error.message));
      return;
    }
    setOpen(false);
    resetJoinDialog();
    setMessage(
      "Check your inbox for the sign-in link (often titled “Magic Link”). Open it on this device — then you’ll set your password and full profile in one form at the top. Check Spam / Promotions if needed.",
    );
  }

  async function signInReturning() {
    if (!returnEmail.trim() || !returnPassword) return;
    setReturnBusy(true);
    setReturnMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: returnEmail.trim().toLowerCase(),
      password: returnPassword,
    });
    setReturnBusy(false);
    if (error) {
      logger.error("HeroRegistration", "signInWithPassword failed", {
        message: error.message,
      });
      const low = error.message.toLowerCase();
      if (
        low.includes("invalid") ||
        low.includes("credentials") ||
        low.includes("password")
      ) {
        setReturnMessage(
          "Wrong email or password. Use “Forgot password?” below for a one-time email link, or the same email and password you saved when you finished your profile.",
        );
      } else {
        setReturnMessage(error.message);
      }
      return;
    }
    setReturnPassword("");
    setReturnMessage(null);
    router.refresh();
  }

  /**
   * JWT user_metadata can hold a stale/wrong UUID; localStorage can hold the
   * id from the wall click. Pick the first id that still exists on master_friends
   * and is not already registered.
   */
  const resolvedCompletionBuddy = useMemo(() => {
    const tryId = (id: string | null | undefined) => {
      if (!id) return null;
      const row = initialOpen.find((b) => b.id === id);
      if (!row || row.is_registered) return null;
      return { id: row.id, fullName: row.display_name };
    };
    return (
      tryId(pendingMasterFriendId) ?? tryId(recoveredBuddy?.id) ?? null
    );
  }, [
    initialOpen,
    pendingMasterFriendId,
    recoveredBuddy?.id,
  ]);

  const completionBuddyId = resolvedCompletionBuddy?.id ?? null;
  const completionBuddyName =
    resolvedCompletionBuddy?.fullName ??
    pendingFullName ??
    recoveredBuddy?.fullName ??
    "";

  async function sendReturningMagicLink() {
    if (!returnEmail.trim()) return;
    setReturnBusy(true);
    setReturnMessage(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirect = `${origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: returnEmail.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirect,
      },
    });
    setReturnBusy(false);
    if (error) {
      logger.error("HeroRegistration", "returning signInWithOtp failed", {
        message: error.message,
        code: error.code,
      });
      setReturnMessage(userFacingAuthEmailError(error.message));
      return;
    }
    setReturnMessage(
      "Check your inbox — open the link on this device to sign in.",
    );
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

        {!isSignedIn ? (
          <div
            id="sign-in"
            className="scroll-mt-24 w-full max-w-lg rounded-xl border border-primary/25 bg-card p-3 shadow-sm md:p-4"
          >
            <p className="font-display text-base font-semibold text-foreground">
              Back again?
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Use the email and password you chose when you completed your
              profile after the email link. New here? Tap your name under{" "}
              <span className="font-medium text-foreground">Names on the wall</span>.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="return-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="return-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={returnEmail}
                  onChange={(e) => setReturnEmail(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="return-password" className="text-xs">
                  Password
                </Label>
                <Input
                  id="return-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={returnPassword}
                  onChange={(e) => setReturnPassword(e.target.value)}
                  className="h-10"
                />
              </div>
              <Button
                type="button"
                className="h-10 w-full shrink-0 px-5 sm:mt-0 sm:w-auto"
                disabled={
                  returnBusy || !returnEmail.trim() || !returnPassword.trim()
                }
                onClick={() => void signInReturning()}
              >
                {returnBusy ? "Signing in…" : "Log in"}
              </Button>
            </div>
            {returnMessage ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {returnMessage}
              </p>
            ) : null}
            <div className="mt-3 border-t border-border pt-3">
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setShowReturnMagicLink((v) => !v)}
              >
                {showReturnMagicLink
                  ? "Hide email link option"
                  : "Forgot password? Send a one-time email link"}
              </button>
              {showReturnMagicLink ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <p className="text-xs text-muted-foreground">
                    We’ll email a link to sign in without your password for this
                    session.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 self-start sm:self-auto"
                    disabled={returnBusy || !returnEmail.trim()}
                    onClick={() => void sendReturningMagicLink()}
                  >
                    Email login link
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {needsProfile ? (
          completionBuddyId ? (
            <div id="finish-profile">
              <ProfileCompletionForm
                masterFriendId={completionBuddyId}
                defaultFullName={completionBuddyName}
                accountEmail={(pendingAccountEmail ?? "").trim()}
              />
            </div>
          ) : (
            <Card
              id="finish-profile"
              className="border-amber-500/40 bg-amber-500/5"
            >
              <CardContent className="pt-6 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  We need one more thing to finish signup
                </p>
                <p className="mt-2">
                  Your account is open, but we couldn’t tell which wall name you
                  picked (often happens after only using email links). Sign out,
                  then tap your name on the wall again and use the same email —
                  or ask the site admin to link your account.
                </p>
              </CardContent>
            </Card>
          )
        ) : null}

        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <h2 className="font-display text-lg font-semibold">
                Names on the wall
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap your name, enter your email, and we’ll send a confirmation
                link. After you open it, you’ll set your password and profile in
                one step.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {openBuddies.length === 0 ? (
                  initialOpen.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No names on the wall yet.
                    </p>
                  ) : (
                    <div className="w-full space-y-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 sm:px-4">
                      <p
                        className="text-base font-medium leading-relaxed text-foreground"
                        lang="te"
                      >
                        అందరూ వచ్చేశారు — ఇక కథలే మిగిలాయి.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Time to spill the fun.
                      </p>
                    </div>
                  )
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
                        resetJoinDialog();
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

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetJoinDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join as {picked?.display_name}</DialogTitle>
            <DialogDescription>
              Enter the email you want as your login ID. We’ll send a link to
              confirm it — then you’ll choose a password and fill in your full
              profile on the next screen (nothing else to fill in here).
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
              onClick={() => void sendJoinMagicLink()}
            >
              {busy ? "Sending…" : "Send confirmation link"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already on the gang? Close this and use{" "}
              <span className="font-medium text-foreground">Back again?</span>{" "}
              above.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
