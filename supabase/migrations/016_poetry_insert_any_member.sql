-- Allow any buddy with a profile to publish poetry_wall (same pattern as cinema).

drop policy if exists "poetry_insert_posters" on public.poetry_wall;

create policy "poetry_insert_members"
  on public.poetry_wall for insert
  to authenticated
  with check (
    posted_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
    )
  );
