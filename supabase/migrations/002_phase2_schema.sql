-- BuddyNagar Phase 2 — cinema, poetry, gallery, suggestions + RLS + storage + RPCs
-- Run after 001_phase1_schema.sql

-- ---------------------------------------------------------------------------
-- Extend tables
-- ---------------------------------------------------------------------------

alter table public.cinema_news add column if not exists content text;
alter table public.cinema_news add column if not exists image_url text;
alter table public.cinema_news add column if not exists movie_name text;
alter table public.cinema_news add column if not exists industry text
  default 'Telugu';
alter table public.cinema_news add column if not exists tags text[];
alter table public.cinema_news add column if not exists likes int not null default 0;
alter table public.cinema_news add column if not exists is_published boolean not null default true;
alter table public.cinema_news add column if not exists published_at timestamptz not null default now();

alter table public.poetry_wall add column if not exists caption text;
alter table public.poetry_wall add column if not exists poet_name text;
alter table public.poetry_wall add column if not exists language text not null default 'Telugu';
alter table public.poetry_wall add column if not exists tags text[];
alter table public.poetry_wall add column if not exists likes int not null default 0;
alter table public.poetry_wall add column if not exists is_published boolean not null default true;
alter table public.poetry_wall add column if not exists posted_at timestamptz not null default now();

alter table public.photo_gallery add column if not exists caption text;
alter table public.photo_gallery add column if not exists year_approx text;
alter table public.photo_gallery add column if not exists likes int not null default 0;
alter table public.photo_gallery add column if not exists uploaded_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Deduped likes
-- ---------------------------------------------------------------------------

create table if not exists public.cinema_news_likes (
  news_id uuid not null references public.cinema_news (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, user_id)
);

create table if not exists public.poetry_wall_likes (
  poem_id uuid not null references public.poetry_wall (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poem_id, user_id)
);

create table if not exists public.photo_gallery_likes (
  photo_id uuid not null references public.photo_gallery (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table public.cinema_news_likes enable row level security;
alter table public.poetry_wall_likes enable row level security;
alter table public.photo_gallery_likes enable row level security;

-- ---------------------------------------------------------------------------
-- RPCs (likes + votes)
-- ---------------------------------------------------------------------------

create or replace function public.like_cinema_news(p_news_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTH';
  end if;
  insert into public.cinema_news_likes (news_id, user_id)
  values (p_news_id, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.cinema_news
    set likes = coalesce(likes, 0) + 1
    where id = p_news_id and coalesce(is_published, true);
  end if;
end;
$$;

create or replace function public.like_poetry_post(p_poem_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTH';
  end if;
  insert into public.poetry_wall_likes (poem_id, user_id)
  values (p_poem_id, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.poetry_wall
    set likes = coalesce(likes, 0) + 1
    where id = p_poem_id and coalesce(is_published, true);
  end if;
end;
$$;

create or replace function public.like_gallery_photo(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTH';
  end if;
  insert into public.photo_gallery_likes (photo_id, user_id)
  values (p_photo_id, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.photo_gallery
    set likes = coalesce(likes, 0) + 1
    where id = p_photo_id and coalesce(is_approved, false);
  end if;
end;
$$;

create or replace function public.vote_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTH';
  end if;
  insert into public.suggestion_votes (suggestion_id, user_id)
  values (p_suggestion_id, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.suggestions
    set votes = coalesce(votes, 0) + 1
    where id = p_suggestion_id;
  end if;
end;
$$;

revoke all on function public.like_cinema_news(uuid) from public;
revoke all on function public.like_poetry_post(uuid) from public;
revoke all on function public.like_gallery_photo(uuid) from public;
revoke all on function public.vote_suggestion(uuid) from public;
grant execute on function public.like_cinema_news(uuid) to authenticated;
grant execute on function public.like_poetry_post(uuid) to authenticated;
grant execute on function public.like_gallery_photo(uuid) to authenticated;
grant execute on function public.vote_suggestion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop Phase 1 deny policies
-- ---------------------------------------------------------------------------

drop policy if exists "cinema_deny" on public.cinema_news;
drop policy if exists "poetry_deny" on public.poetry_wall;
drop policy if exists "gallery_deny" on public.photo_gallery;
drop policy if exists "suggestions_deny" on public.suggestions;
drop policy if exists "suggestion_votes_deny" on public.suggestion_votes;

-- ---------------------------------------------------------------------------
-- cinema_news RLS
-- ---------------------------------------------------------------------------

create policy "cinema_select_published"
  on public.cinema_news for select
  using (coalesce(is_published, true));

create policy "cinema_insert_posters"
  on public.cinema_news for insert
  to authenticated
  with check (
    posted_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (
        p.roles @> array['admin']::text[]
        or p.roles @> array['cinema_poster']::text[]
      )
    )
  );

-- ---------------------------------------------------------------------------
-- poetry_wall RLS
-- ---------------------------------------------------------------------------

create policy "poetry_select_published"
  on public.poetry_wall for select
  using (coalesce(is_published, true));

create policy "poetry_insert_posters"
  on public.poetry_wall for insert
  to authenticated
  with check (
    posted_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and (
        p.roles @> array['admin']::text[]
        or p.roles @> array['poetry_poster']::text[]
      )
    )
  );

-- ---------------------------------------------------------------------------
-- photo_gallery RLS
-- ---------------------------------------------------------------------------

create policy "gallery_select_visible"
  on public.photo_gallery for select
  using (
    coalesce(is_approved, false)
    or uploaded_by = auth.uid()
  );

create policy "gallery_insert_auth"
  on public.photo_gallery for insert
  to authenticated
  with check (uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- suggestions + votes RLS
-- ---------------------------------------------------------------------------

create policy "suggestions_select_all"
  on public.suggestions for select
  using (true);

create policy "suggestions_insert_own"
  on public.suggestions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Clients do not insert votes directly; use vote_suggestion RPC
create policy "suggestion_votes_select_own"
  on public.suggestion_votes for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Like tables — read own row to show “liked” UI; mutations via RPC only
-- ---------------------------------------------------------------------------

create policy "cinema_likes_select_own"
  on public.cinema_news_likes for select
  to authenticated
  using (user_id = auth.uid());

create policy "poetry_likes_select_own"
  on public.poetry_wall_likes for select
  to authenticated
  using (user_id = auth.uid());

create policy "gallery_likes_select_own"
  on public.photo_gallery_likes for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------------

drop policy if exists "storage_cinema_public_read" on storage.objects;
drop policy if exists "storage_cinema_auth_upload" on storage.objects;
drop policy if exists "storage_poetry_public_read" on storage.objects;
drop policy if exists "storage_poetry_auth_upload" on storage.objects;
drop policy if exists "storage_gallery_public_read" on storage.objects;
drop policy if exists "storage_gallery_auth_upload" on storage.objects;

insert into storage.buckets (id, name, public)
values
  ('buddynagar-cinema', 'buddynagar-cinema', true),
  ('buddynagar-poetry', 'buddynagar-poetry', true),
  ('buddynagar-gallery', 'buddynagar-gallery', true)
on conflict (id) do nothing;

create policy "storage_cinema_public_read"
  on storage.objects for select
  using (bucket_id = 'buddynagar-cinema');

create policy "storage_cinema_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'buddynagar-cinema'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_poetry_public_read"
  on storage.objects for select
  using (bucket_id = 'buddynagar-poetry');

create policy "storage_poetry_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'buddynagar-poetry'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_gallery_public_read"
  on storage.objects for select
  using (bucket_id = 'buddynagar-gallery');

create policy "storage_gallery_auth_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'buddynagar-gallery'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.cinema_news;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.poetry_wall;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.suggestions;
exception when duplicate_object then null;
end $$;
