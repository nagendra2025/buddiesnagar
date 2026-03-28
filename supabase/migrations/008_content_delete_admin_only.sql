-- Only profiles with role `admin` may DELETE cinema, poetry, or gallery rows via the
-- authenticated Supabase client. Everyone else cannot remove posts (including others').
-- Service role (cron, server API) still bypasses RLS.

create policy "cinema_delete_admin"
  on public.cinema_news for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  );

create policy "poetry_delete_admin"
  on public.poetry_wall for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  );

create policy "gallery_delete_admin"
  on public.photo_gallery for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  );
