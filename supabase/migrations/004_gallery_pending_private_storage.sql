-- Memory lane: keep new files in a private bucket until admin approves.
-- Client inserts are disabled; uploads go through Next.js API (service role).

alter table public.photo_gallery alter column image_url drop not null;

alter table public.photo_gallery add column if not exists pending_storage_path text;

comment on column public.photo_gallery.pending_storage_path is
  'Object path in buddynagar-gallery-pending while awaiting approval; cleared after promotion to public gallery.';

insert into storage.buckets (id, name, public)
values ('buddynagar-gallery-pending', 'buddynagar-gallery-pending', false)
on conflict (id) do nothing;

-- Only service role should touch this bucket (no anon/authenticated policies).

drop policy if exists "gallery_insert_auth" on public.photo_gallery;
