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
import ProfileCompletionForm from "@/components/shared/ProfileCompletionForm";

const MIN_PASSWORD_LEN = 8;

interface HeroRegistrationProps {
  initialOpen: MasterFriend[];
  initialJoined: Profile[];
  pendingMasterFriendId: string | null;
  pendingFullName: string | null;
  needsProfile: boolean;
  isSignedIn?: boolean;
}

export default function HeroRegistration({
  initialOpen,
  initialJoined,
  pendingMasterFriendId,
  pendingFullName,
  needsProfile,
  isSignedIn = false,
}: HeroRegistrationProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<MasterFriend | null>(null);
  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [joinUseMagicLink, setJoinUseMagicLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<Profile[]>(initialJoined);
  const [returnEmail, setReturnEmail] = useState("");
  const [returnPassword, setReturnPassword] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnMessage, setReturnMessage] = useState<string | null>(null);
  const [showReturnMagicLink, setShowReturnMagicLink] = useState(false);

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

  function resetJoinDialog() {
    setEmail("");
    setRegPassword("");
    setRegPasswordConfirm("");
    setJoinUseMagicLink(false);
  }

  async function registerWithPassword() {
    if (!picked || !email.trim()) return;
    if (regPassword.length < MIN_PASSWORD_LEN) {
      setMessage(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirect = `${origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: regPassword,
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
      logger.error("HeroRegistration", "signUp failed", {
        message: error.message,
      });
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists")
      ) {
        setMessage(
          "That email already has an account. Close this dialog and use “Back again?” to log in.",
        );
      } else {
        setMessage(error.message || "Could not create account. Try again.");
      }
      return;
    }
    setOpen(false);
    resetJoinDialog();
    if (data.session) {
      setMessage(
        "You’re signed in. Complete your profile below if you see the form.",
      );
      router.refresh();
    } else {
      setMessage(
        "Confirm the email we sent you (one time). After that, use “Back again?” with your email and password.",
      );
    }
  }

  async function sendJoinMagicLink() {
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
    setOpen(false);
    resetJoinDialog();
    setMessage("Check your inbox for the BuddyNagar login link.");
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
          "Wrong email or password. If you joined before passwords existed, expand “No password yet?” and use a one-time email link.",
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
      });
      setReturnMessage("Could not send email. Check the address and try again.");
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
            className="scroll-mt-24 rounded-xl border border-primary/25 bg-card p-4 shadow-sm md:p-5"
          >
            <p className="font-display text-lg font-semibold text-foreground">
              Back again?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log in with the email and password you chose when you joined. New
              buddy? Pick your name under “Names on the wall” instead.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="return-email">Email</Label>
                <Input
                  id="return-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={returnEmail}
                  onChange={(e) => setReturnEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="return-password">Password</Label>
                <Input
                  id="return-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={returnPassword}
                  onChange={(e) => setReturnPassword(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 h-11 w-full sm:w-auto"
              disabled={
                returnBusy || !returnEmail.trim() || !returnPassword.trim()
              }
              onClick={() => void signInReturning()}
            >
              {returnBusy ? "Signing in…" : "Log in"}
            </Button>
            {returnMessage ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {returnMessage}
              </p>
            ) : null}
            <div className="mt-4 border-t border-border pt-4">
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setShowReturnMagicLink((v) => !v)}
              >
                {showReturnMagicLink
                  ? "Hide email link option"
                  : "No password yet? Send a one-time email link"}
              </button>
              {showReturnMagicLink ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <p className="text-xs text-muted-foreground sm:max-w-xs">
                    For accounts created before passwords, or if you forgot
                    yours and reset isn’t set up yet.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
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
                Tap your name, then create your account with email and password.
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
              {joinUseMagicLink
                ? "We’ll email you a one-time link (no password)."
                : `Use your email as your login ID. Choose a password (at least ${MIN_PASSWORD_LEN} characters).`}
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
            {!joinUseMagicLink ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={`At least ${MIN_PASSWORD_LEN} characters`}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-password2">Confirm password</Label>
                  <Input
                    id="reg-password2"
                    type="password"
                    autoComplete="new-password"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={
                    busy ||
                    !email.trim() ||
                    regPassword.length < MIN_PASSWORD_LEN ||
                    regPassword !== regPasswordConfirm
                  }
                  onClick={() => void registerWithPassword()}
                >
                  {busy ? "Creating account…" : "Create account & sign in"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={busy || !email.trim()}
                onClick={() => void sendJoinMagicLink()}
              >
                {busy ? "Sending…" : "Send magic link"}
              </Button>
            )}
            <button
              type="button"
              className="text-center text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setJoinUseMagicLink((x) => !x)}
            >
              {joinUseMagicLink
                ? "Use email + password instead"
                : "Prefer a one-time email link?"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
