export type BuddyRole = "member" | "admin" | "cinema_poster" | "poetry_poster";

export interface Profile {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  birthday_year?: number | null;
  roles: BuddyRole[] | string[];
  join_order: number | null;
  joined_at: string;
}

export interface MasterFriend {
  id: string;
  display_name: string;
  is_registered: boolean;
  registered_profile_id: string | null;
  join_order: number | null;
}

export interface Wish {
  id: string;
  type: string;
  title: string;
  message: string | null;
  banner_color: string | null;
  icon_emoji: string | null;
  wish_date: string | null;
  is_recurring: boolean;
  is_active: boolean;
}

export interface FunFact {
  id: string;
  fact_text: string;
  category: string | null;
  show_date: string | null;
  reactions: Record<string, string>;
}

export interface NewsArticle {
  id: string;
  category: string;
  title: string | null;
  description: string | null;
  url: string | null;
  image_url: string | null;
  source_name: string | null;
  published_at: string | null;
  fetched_at: string;
}

export const NEWS_CATEGORIES = [
  "Telugu News",
  "National",
  "World",
  "Cricket",
  "Technology",
  "Health & Wellness",
  "Finance & Markets",
  "Entertainment",
  "Science",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export type CinemaIndustry = "Telugu" | "Hindi" | "Tamil" | "Hollywood";

export interface CinemaNewsRow {
  id: string;
  posted_by: string;
  title: string;
  content: string | null;
  image_url: string | null;
  movie_name: string | null;
  industry: string;
  tags: string[] | null;
  likes: number;
  is_published: boolean;
  published_at: string;
  created_at?: string;
  profiles?: { full_name: string } | null;
}

export type PoetryLanguage = "Telugu" | "Urdu" | "Hindi" | "English";

export interface PoetryWallRow {
  id: string;
  posted_by: string;
  image_url: string;
  caption: string | null;
  poet_name: string | null;
  language: string;
  tags: string[] | null;
  likes: number;
  is_published: boolean;
  posted_at: string;
  profiles?: { full_name: string } | null;
}

export interface GalleryPhotoRow {
  id: string;
  uploaded_by: string;
  /** Public URL after approval; null while waiting in private pending storage. */
  image_url: string | null;
  caption: string | null;
  year_approx: string | null;
  likes: number;
  is_approved: boolean;
  uploaded_at: string;
  pending_storage_path?: string | null;
  /** Server-signed URL for pending rows (short-lived). */
  preview_url?: string | null;
  profiles?: { full_name: string } | null;
}

export interface SuggestionRow {
  id: string;
  user_id: string | null;
  content: string;
  status: string;
  votes: number;
  created_at: string;
  profiles?: { full_name: string } | null;
}
