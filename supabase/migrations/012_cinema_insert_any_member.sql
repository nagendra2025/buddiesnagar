-- Allow any buddy with a profile to publish cinema_news (not only admin / cinema_poster).

drop policy if exists "cinema_insert_posters" on public.cinema_news;

create policy "cinema_insert_members"
  on public.cinema_news for insert
  to authenticated
  with check (
    posted_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
    )
  );
