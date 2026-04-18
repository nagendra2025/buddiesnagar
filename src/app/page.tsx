import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/shared/SiteNav";
import ScrollProgress from "@/components/shared/ScrollProgress";
import HeroRegistration from "@/components/sections/HeroRegistration";
import ProfilesSection from "@/components/sections/ProfilesSection";
import SpotlightSection from "@/components/sections/SpotlightSection";
import FunFactSection from "@/components/sections/FunFactSection";
import NewsSection from "@/components/sections/NewsSection";
import CinemaNewsSection from "@/components/sections/CinemaNewsSection";
import PoetryWallSection from "@/components/sections/PoetryWallSection";
import MemoryLaneSection from "@/components/sections/MemoryLaneSection";
import SuggestionsSection from "@/components/sections/SuggestionsSection";
import TimezonesSection from "@/components/sections/TimezonesSection";
import Phase3PlaygroundSection from "@/components/sections/Phase3PlaygroundSection";
import { canPostCinema, canPostPoetry, isAdmin } from "@/lib/permissions";
import { oneEmbedded } from "@/lib/embeddings";
import type {
  CinemaNewsRow,
  FunFact,
  GalleryPhotoRow,
  MasterFriend,
  PoetryWallRow,
  Profile,
  SuggestionRow,
  Wish,
} from "@/lib/types";
import type { NewsCategory } from "@/lib/types";
import Link from "next/link";
import { signPendingGalleryPreviews } from "@/lib/gallerySignedPreview";
import { contentExpiryCutoffIso } from "@/lib/contentTtl";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function ConfigMissing() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold">BuddyNagar setup</p>
      <p className="mt-3 max-w-md text-muted-foreground">
        Copy{" "}
        <code className="rounded bg-muted px-1">.env.example</code> to{" "}
        <code className="rounded bg-muted px-1">.env.local</code> and add your
        Supabase URL and anon key. Then run the SQL migration in{" "}
        <code className="rounded bg-muted px-1">supabase/migrations</code>.
      </p>
    </main>
  );
}

/**
 * One fact per calendar day, cycling through the list in stable order (created_at).
 * After N facts, day N+1 shows fact #1 again — true round-robin across the year.
 */
function pickTodayFact(facts: FunFact[]): FunFact | null {
  if (facts.length === 0) return null;
  const sorted = [...facts].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfYear = Math.round((today.getTime() - start.getTime()) / 86400000);
  const idx = (dayOfYear - 1) % sorted.length;
  return sorted[idx] ?? sorted[0] ?? null;
}

export default async function Home() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <ConfigMissing />;
  }

  const supabase = await createClient();

  const [
    { data: masterFriends, error: mfError },
    { data: profiles },
    { data: wishes },
    { data: funFacts },
    { data: userData },
  ] = await Promise.all([
    supabase.from("master_friends").select("*").order("display_name"),
    supabase.from("profiles").select("*").order("join_order", { ascending: true }),
    supabase.from("wishes").select("*").eq("is_active", true),
    supabase.from("fun_facts").select("*").order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (mfError) {
    return (
      <main className="p-8 text-center text-red-600">
        Could not load buddy list. Check Supabase tables and RLS.
      </main>
    );
  }

  const user = userData.user;
  let myProfile: Profile | null = null;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    myProfile = prof as Profile | null;
  }

  const meta = user?.user_metadata as Record<string, string | undefined> | undefined;
  const pendingMasterFriendId =
    typeof meta?.master_friend_id === "string" ? meta.master_friend_id : null;
  const pendingFullName =
    typeof meta?.full_name === "string" ? meta.full_name : null;
  /** Any signed-in user without a row in `profiles` still needs the full details form. */
  const needsProfile = Boolean(user && !myProfile);

  const openFriends = (masterFriends ?? []) as MasterFriend[];
  const joined = (profiles ?? []) as Profile[];
  const wishList = (wishes ?? []) as Wish[];
  const facts = (funFacts ?? []) as FunFact[];
  const todayFact = pickTodayFact(facts);

  const defaultNewsCategory: NewsCategory = "Cricket";
  const postsNotOlderThan = contentExpiryCutoffIso();

  const cinemaSelect =
    "id, posted_by, title, content, image_url, movie_name, industry, tags, likes, is_published, published_at, profiles!posted_by(full_name)";
  const poetrySelect =
    "id, posted_by, image_url, caption, poet_name, language, tags, likes, is_published, posted_at, profiles!posted_by(full_name)";
  const gallerySelect =
    "id, uploaded_by, image_url, caption, year_approx, likes, is_approved, uploaded_at, pending_storage_path, profiles!uploaded_by(full_name)";
  const suggestionSelect =
    "id, user_id, content, status, votes, created_at, profiles!user_id(full_name, nickname)";

  const galleryAsAdmin = Boolean(user && isAdmin(myProfile));
  let galleryQ = supabase
    .from("photo_gallery")
    .select(gallerySelect)
    .gte("uploaded_at", postsNotOlderThan);
  if (galleryAsAdmin) {
    // RLS allows admins to read all rows (see migration 003).
  } else if (user) {
    galleryQ = galleryQ.or(`is_approved.eq.true,uploaded_by.eq.${user.id}`);
  } else {
    galleryQ = galleryQ.eq("is_approved", true);
  }

  const [
    { data: cinemaRows },
    { data: poetryRows },
    { data: galleryRows },
    suggestionsResult,
    { data: cinemaLikeRows },
    { data: poetryLikeRows },
    { data: galleryLikeRows },
    { data: voteRows },
  ] = await Promise.all([
    supabase
      .from("cinema_news")
      .select(cinemaSelect)
      .eq("is_published", true)
      .gte("published_at", postsNotOlderThan)
      .order("published_at", { ascending: false }),
    supabase
      .from("poetry_wall")
      .select(poetrySelect)
      .eq("is_published", true)
      .gte("posted_at", postsNotOlderThan)
      .order("posted_at", { ascending: false }),
    galleryQ.order("uploaded_at", { ascending: false }),
    supabase
      .from("suggestions")
      .select(suggestionSelect)
      .order("created_at", { ascending: false }),
    user
      ? supabase.from("cinema_news_likes").select("news_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { news_id: string }[] | null }),
    user
      ? supabase.from("poetry_wall_likes").select("poem_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { poem_id: string }[] | null }),
    user
      ? supabase.from("photo_gallery_likes").select("photo_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { photo_id: string }[] | null }),
    user
      ? supabase.from("suggestion_votes").select("suggestion_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { suggestion_id: string }[] | null }),
  ]);

  const { data: suggestionRows, error: suggestionQueryError } = suggestionsResult;
  if (suggestionQueryError) {
    logger.error("Home", "suggestions fetch failed", {
      message: suggestionQueryError.message,
    });
  }

  type P = { full_name: string };
  type SuggestionProfile = { full_name: string; nickname?: string | null };

  const cinemaItems = (cinemaRows ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    profiles: oneEmbedded<P>(
      (r as { profiles?: P | P[] | null }).profiles ?? null,
    ),
  })) as CinemaNewsRow[];

  const poetryItems = (poetryRows ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    profiles: oneEmbedded<P>(
      (r as { profiles?: P | P[] | null }).profiles ?? null,
    ),
  })) as PoetryWallRow[];

  const galleryItems = (galleryRows ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    profiles: oneEmbedded<P>(
      (r as { profiles?: P | P[] | null }).profiles ?? null,
    ),
  })) as GalleryPhotoRow[];

  const pendingPreviewTargets = galleryItems
    .filter((r) => !r.is_approved && r.pending_storage_path)
    .map((r) => ({ id: r.id, path: r.pending_storage_path ?? null }));

  const previewMap = await signPendingGalleryPreviews(pendingPreviewTargets, 3600);

  const galleryItemsWithPreview = galleryItems.map((r) => ({
    ...r,
    preview_url: previewMap.get(r.id),
  }));

  const suggestionItems = (suggestionRows ?? []).map((r) => ({
    ...(r as Record<string, unknown>),
    profiles: oneEmbedded<SuggestionProfile>(
      (r as { profiles?: SuggestionProfile | SuggestionProfile[] | null }).profiles ??
        null,
    ),
  })) as SuggestionRow[];

  const likedCinema = (cinemaLikeRows ?? []).map((r) => r.news_id);
  const likedPoetry = (poetryLikeRows ?? []).map((r) => r.poem_id);
  const likedGallery = (galleryLikeRows ?? []).map((r) => r.photo_id);
  const votedIds = (voteRows ?? []).map((r) => r.suggestion_id);

  return (
    <>
      <ScrollProgress />
      <SiteNav isSignedIn={Boolean(user)} />
      <main className="flex-1">
        <HeroRegistration
          initialOpen={openFriends}
          initialJoined={joined}
          pendingMasterFriendId={pendingMasterFriendId}
          pendingFullName={pendingFullName}
          needsProfile={needsProfile}
          isSignedIn={Boolean(user)}
          pendingAccountEmail={user?.email ?? null}
        />
        <ProfilesSection profiles={joined} currentUserId={user?.id ?? null} />
        {user ? <SpotlightSection profiles={joined} wishes={wishList} /> : null}
        <FunFactSection fact={todayFact} userId={user?.id ?? null} />
        {user ? <NewsSection defaultCategory={defaultNewsCategory} /> : null}
        <CinemaNewsSection
          initialItems={cinemaItems}
          userId={user?.id ?? null}
          canPost={canPostCinema(user?.id ?? null)}
          likedIds={likedCinema}
        />
        <PoetryWallSection
          initialItems={poetryItems}
          userId={user?.id ?? null}
          canPost={canPostPoetry(user?.id ?? null)}
          likedIds={likedPoetry}
        />
        <MemoryLaneSection
          initialItems={galleryItemsWithPreview}
          userId={user?.id ?? null}
          isAdmin={galleryAsAdmin}
          likedIds={likedGallery}
        />
        {user ? <TimezonesSection /> : null}
        {user ? <Phase3PlaygroundSection /> : null}
        <SuggestionsSection
          initialItems={suggestionItems}
          userId={user?.id ?? null}
          votedIds={votedIds}
        />
        <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
          <p>Kadapa Buddies — BuddyNagar</p>
          <p className="mt-1">{joined.length} buddies and counting</p>
          <Link href="#hero" className="mt-4 inline-block text-primary">
            Back to top
          </Link>
        </footer>
      </main>
    </>
  );
}
