-- BuddyNagar — admins can see all gallery rows and approve pending uploads

-- Admins may SELECT every photo (including others' unapproved uploads).
create policy "gallery_select_admin_all"
  on public.photo_gallery for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  );

-- Admins may UPDATE rows (used to set is_approved = true).
create policy "gallery_update_admin"
  on public.photo_gallery for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
      and coalesce(p.roles, '{}') @> array['admin']::text[]
    )
  );
