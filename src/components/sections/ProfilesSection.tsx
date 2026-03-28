import type { Profile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AvatarFallback from "@/components/shared/AvatarFallback";

export default function ProfilesSection({ profiles }: { profiles: Profile[] }) {
  const sorted = [...profiles].sort(
    (a, b) => (a.join_order ?? 999) - (b.join_order ?? 999),
  );

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
          The Kadapa buddies on BuddyNagar, in join order.
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
                  <AvatarFallback
                    name={p.full_name}
                    className="h-14 w-14 text-base"
                  />
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
    </section>
  );
}
