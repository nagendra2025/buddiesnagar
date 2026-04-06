-- Add timezone for member profile edits (required by UI/API going forward).
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists timezone text;

