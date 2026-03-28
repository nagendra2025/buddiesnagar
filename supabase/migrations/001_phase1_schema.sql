-- BuddyNagar Phase 1 — schema, RLS, registration RPC, realtime
-- Run in Supabase SQL editor or via CLI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  avatar_url text,
  city text,
  bio text,
  birthday_month int,
  birthday_day int,
  roles text[] not null default array['member']::text[],
  join_order int,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_birthday_month_chk check (birthday_month is null or (birthday_month between 1 and 12)),
  constraint profiles_birthday_day_chk check (birthday_day is null or (birthday_day between 1 and 31))
);

create table if not exists public.master_friends (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  is_registered boolean not null default false,
  registered_profile_id uuid references public.profiles (id) on delete set null,
  join_order int,
  created_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text,
  banner_color text,
  icon_emoji text,
  wish_date date,
  is_recurring boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fun_facts (
  id uuid primary key default gen_random_uuid(),
  fact_text text not null,
  category text,
  show_date date,
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.news_articles_cache (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text,
  description text,
  url text,
  image_url text,
  source_name text,
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

-- Minimal placeholders for later PRD phases (FK targets)
create table if not exists public.cinema_news (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid references public.profiles (id),
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.poetry_wall (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid references public.profiles (id),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.photo_gallery (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.profiles (id),
  image_url text not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  content text not null,
  status text not null default 'pending',
  votes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestion_votes (
  suggestion_id uuid references public.suggestions (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (suggestion_id, user_id)
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient text not null,
  payload jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- Registration (SECURITY DEFINER) — RLS-safe buddy completion
-- ---------------------------------------------------------------------------

create or replace function public.complete_registration(
  p_master_friend_id uuid,
  p_full_name text,
  p_phone text,
  p_city text,
  p_bio text,
  p_birthday_month int,
  p_birthday_day int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mf public.master_friends%rowtype;
  next_join int;
  auth_email text;
  bio_trim text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'PROFILE_EXISTS';
  end if;

  select email::text into auth_email from auth.users where id = auth.uid();
  if auth_email is null or length(trim(auth_email)) = 0 then
    raise exception 'NO_EMAIL';
  end if;

  select * into mf from public.master_friends where id = p_master_friend_id for update;
  if not found then
    raise exception 'INVALID_BUDDY';
  end if;
  if mf.is_registered then
    raise exception 'ALREADY_REGISTERED';
  end if;

  -- Feb 29: allow only if valid for some leap year (store as-is; spotlight uses month/day)
  if p_birthday_month is not null and p_birthday_day is not null then
    if p_birthday_month = 2 and p_birthday_day > 29 then
      raise exception 'INVALID_BIRTHDAY';
    end if;
    if p_birthday_month in (4, 6, 9, 11) and p_birthday_day > 30 then
      raise exception 'INVALID_BIRTHDAY';
    end if;
  end if;

  bio_trim := left(trim(coalesce(p_bio, '')), 120);

  select coalesce(max(join_order), 0) + 1 into next_join from public.profiles;

  insert into public.profiles (
    id, full_name, email, phone, city, bio,
    birthday_month, birthday_day, roles, join_order
  ) values (
    auth.uid(),
    trim(p_full_name),
    lower(trim(auth_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(bio_trim, ''),
    p_birthday_month,
    p_birthday_day,
    array['member']::text[],
    next_join
  );

  update public.master_friends
  set
    is_registered = true,
    registered_profile_id = auth.uid(),
    join_order = next_join
  where id = p_master_friend_id;
end;
$$;

revoke all on function public.complete_registration(uuid, text, text, text, text, int, int) from public;
grant execute on function public.complete_registration(uuid, text, text, text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.master_friends enable row level security;
alter table public.wishes enable row level security;
alter table public.fun_facts enable row level security;
alter table public.news_articles_cache enable row level security;
alter table public.cinema_news enable row level security;
alter table public.poetry_wall enable row level security;
alter table public.photo_gallery enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
alter table public.email_logs enable row level security;

-- Profiles
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Master friends (read-only for clients; updates via RPC as table owner)
drop policy if exists "master_friends_select" on public.master_friends;
create policy "master_friends_select"
  on public.master_friends for select
  using (true);

-- Wishes
drop policy if exists "wishes_select" on public.wishes;
create policy "wishes_select"
  on public.wishes for select
  using (coalesce(is_active, true));

-- Fun facts
drop policy if exists "fun_facts_select" on public.fun_facts;
create policy "fun_facts_select"
  on public.fun_facts for select
  using (true);

drop policy if exists "fun_facts_update_reactions" on public.fun_facts;
create policy "fun_facts_update_reactions"
  on public.fun_facts for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- News cache: public read of cached headlines; writes via service role in API routes
drop policy if exists "news_cache_select_public" on public.news_articles_cache;
create policy "news_cache_select_public"
  on public.news_articles_cache for select
  using (true);

-- Placeholder tables — locked down until later phases
drop policy if exists "cinema_deny" on public.cinema_news;
create policy "cinema_deny" on public.cinema_news for select using (false);

drop policy if exists "poetry_deny" on public.poetry_wall;
create policy "poetry_deny" on public.poetry_wall for select using (false);

drop policy if exists "gallery_deny" on public.photo_gallery;
create policy "gallery_deny" on public.photo_gallery for select using (false);

drop policy if exists "suggestions_deny" on public.suggestions;
create policy "suggestions_deny" on public.suggestions for select using (false);

drop policy if exists "suggestion_votes_deny" on public.suggestion_votes;
create policy "suggestion_votes_deny" on public.suggestion_votes for select using (false);

drop policy if exists "email_logs_deny" on public.email_logs;
create policy "email_logs_deny" on public.email_logs for select using (false);

-- ---------------------------------------------------------------------------
-- Realtime (profiles for live buddy wall)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;
