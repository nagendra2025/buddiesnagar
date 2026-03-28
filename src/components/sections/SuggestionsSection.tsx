"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SuggestionRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { logger } from "@/lib/logger";

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
              Ideas for BuddyNagar — vote for what the gang wants most.
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
            Log in with your magic link to suggest ideas or vote.
          </p>
        )}

        <ul className="mt-8 flex flex-col gap-3">
          {sorted.length === 0 ? (
            <li className="text-center text-muted-foreground">
              No suggestions yet — add the first one.
            </li>
          ) : (
            sorted.map((s) => (
              <li key={s.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-base leading-relaxed">{s.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.profiles?.full_name ?? "Buddy"} ·{" "}
                        <Badge variant="outline" className="ml-1">
                          {s.status}
                        </Badge>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!userId || voted.has(s.id)}
                      onClick={() => void vote(s.id)}
                      className="shrink-0"
                    >
                      {voted.has(s.id) ? "Voted" : `Upvote · ${s.votes ?? 0}`}
                    </Button>
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
