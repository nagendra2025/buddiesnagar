"use client";

import { useMemo, useState } from "react";
import type { FunFact } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const REACTIONS = ["😮", "🤣", "💡", "👍", "❤️"] as const;

interface FunFactSectionProps {
  fact: FunFact | null;
  userId: string | null;
}

export default function FunFactSection({ fact, userId }: FunFactSectionProps) {
  const [reactions, setReactions] = useState<Record<string, string>>(
    fact?.reactions ?? {},
  );
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    Object.values(reactions).forEach((e) => {
      tally[e] = (tally[e] ?? 0) + 1;
    });
    return tally;
  }, [reactions]);

  async function react(emoji: string) {
    if (!fact || !userId) return;
    setBusy(emoji);
    try {
      const res = await fetch(`/api/fun-facts/${fact.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = (await res.json()) as {
        reactions?: Record<string, string>;
      };
      if (res.ok && data.reactions) {
        setReactions(data.reactions);
      }
    } finally {
      setBusy(null);
    }
  }

  if (!fact) {
    return (
      <section
        id="funfact"
        className="scroll-mt-20 border-b border-border py-12 px-4"
      >
        <div className="mx-auto max-w-5xl text-center text-muted-foreground">
          <p className="mb-3 text-4xl" aria-hidden>
            💡
          </p>
          <p>No fun fact loaded yet — add rows in Supabase or run the seed.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="funfact"
      className="scroll-mt-20 border-b border-border py-12 px-4"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Fun fact of the day
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A tiny spark for the group chat.
        </p>
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="font-display text-lg">Did you know?</CardTitle>
            {fact.category ? (
              <Badge variant="outline" className="ml-auto">
                {fact.category}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg leading-relaxed">{fact.fact_text}</p>
            <div className="flex flex-wrap gap-2">
              {REACTIONS.map((e) => (
                <Button
                  key={e}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!userId || busy !== null}
                  className="text-base"
                  onClick={() => void react(e)}
                >
                  <span>{e}</span>
                  <span className="ml-1 text-muted-foreground">
                    {counts[e] ?? 0}
                  </span>
                </Button>
              ))}
            </div>
            {!userId ? (
              <p className="text-sm text-muted-foreground">
                Log in with your magic link to leave a reaction.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
