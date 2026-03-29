"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { SuggestionRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { logger } from "@/lib/logger";
import AvatarFallback from "@/components/shared/AvatarFallback";

function submitterLabel(s: SuggestionRow): string {
  const nick = s.profiles?.nickname?.trim();
  if (nick) return nick;
  const name = s.profiles?.full_name?.trim();
  if (name) return name;
  return "Buddy";
}

interface SuggestionsSectionProps {
  initialItems: SuggestionRow[];
  userId: string | null;
  votedIds: string[];
}

export default function SuggestionsSection({
  initialItems,
  userId,
  votedIds: initialVoted,
}: SuggestionsSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [voted, setVoted] = useState(() => new Set(initialVoted));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setVoted(new Set(initialVoted));
  }, [initialVoted]);

  async function submitSuggestion() {
    if (!userId || text.trim().length < 3) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Could not submit");
        setBusy(false);
        return;
      }
      setText("");
      router.refresh();
    } catch (e) {
      logger.error("SuggestionsSection", "submit failed", {
        message: e instanceof Error ? e.message : "unknown",
      });
      setMsg("Network error");
    }
    setBusy(false);
  }

  async function vote(id: string) {
    if (!userId || voted.has(id)) return;
    const res = await fetch(`/api/suggestions/${id}/vote`, { method: "POST" });
    if (res.ok) {
      setVoted((prev) => new Set(prev).add(id));
      setItems((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, votes: (s.votes ?? 0) + 1 } : s,
        ),
      );
    }
  }

  const sorted = [...items].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

  return (
    <section id="suggest" className="scroll-mt-20 py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-1 h-8 w-8 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              What should we add next?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ideas for BuddyNagar — vote for what the gang wants most. Everyone
              can see who suggested what.
            </p>
          </div>
        </div>

        {userId ? (
          <Card className="mt-6">
            <CardContent className="space-y-3 pt-6">
              <Label htmlFor="sug-body">Your idea</Label>
              <Textarea
                id="sug-body"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Recipes corner, reunion planner, book club…"
                maxLength={2000}
              />
              {msg ? (
                <p className="text-sm text-red-600" role="alert">
                  {msg}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={busy || text.trim().length < 3}
                onClick={() => void submitSuggestion()}
              >
                {busy ? "Sending…" : "Submit suggestion"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            <a href="#sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </a>{" "}
            to suggest ideas or vote.
          </p>
        )}

        <ul className="mt-8 flex flex-col gap-4">
          {sorted.length === 0 ? (
            <li className="text-center text-muted-foreground">
              No suggestions yet — add the first one.
            </li>
          ) : (
            sorted.map((s) => (
              <li key={s.id}>
                <Card className="overflow-hidden border-primary/15 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
                    <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center sm:pt-1">
                      <AvatarFallback
                        name={submitterLabel(s)}
                        className="h-12 w-12 text-sm ring-2 ring-primary/20"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <p className="font-semibold text-foreground">
                          {submitterLabel(s)}
                        </p>
                        {s.profiles?.full_name?.trim() &&
                        submitterLabel(s) !== s.profiles.full_name.trim() ? (
                          <span className="text-xs text-muted-foreground">
                            ({s.profiles.full_name.trim()})
                          </span>
                        ) : null}
                        <Badge variant="outline" className="text-xs">
                          {s.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(s.created_at), "MMM d, yyyy · h:mm a")}
                      </p>
                      <p className="mt-3 text-base leading-relaxed text-foreground">
                        {s.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center sm:flex-col sm:justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!userId || voted.has(s.id)}
                        onClick={() => void vote(s.id)}
                        className="w-full min-w-[8rem] sm:w-auto"
                      >
                        {voted.has(s.id) ? "Voted" : `Upvote · ${s.votes ?? 0}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
