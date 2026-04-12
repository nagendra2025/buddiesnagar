-- Phase 3: TTL-friendly cache for weather/cricket API routes + dedupe marks for cron emails.

create table if not exists public.api_response_cache (
  cache_key text primary key,
  body jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.api_response_cache enable row level security;

create table if not exists public.email_send_marks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  period_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, event_type, period_key)
);

create index if not exists email_send_marks_event_period_idx
  on public.email_send_marks (event_type, period_key);

alter table public.email_send_marks enable row level security;
