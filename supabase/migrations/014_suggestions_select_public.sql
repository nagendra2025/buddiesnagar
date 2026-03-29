-- Ensure all visitors (anon + authenticated) can read suggestions for the Ideas board.
-- Safe if 002 already created suggestions_select_all; this recreates it for `to public`.

drop policy if exists "suggestions_select_all" on public.suggestions;

create policy "suggestions_select_all"
  on public.suggestions
  for select
  to public
  using (true);
