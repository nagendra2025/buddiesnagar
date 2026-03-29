-- ---------------------------------------------------------------------------
-- One-off: remove a buddy’s app data so you can delete their profile row,
-- then remove them from Supabase Auth.
--
-- Run in Supabase → SQL Editor (use “Run” with role that bypasses RLS, e.g. postgres).
--
-- 1) Change ONLY the uuid in uid below (same as profiles.id = auth.users.id).
-- 2) Run the whole script.
-- 3) Dashboard → Authentication → Users → delete that user by email.
--
-- Storage: optionally remove files in Storage whose path starts with that user id
-- (buddynagar-cinema, buddynagar-poetry, buddynagar-gallery, buddynagar-gallery-pending).
-- ---------------------------------------------------------------------------

do $$
declare
  uid uuid := '0540c805-6ba9-46db-869f-09f9aa04ebc5';  -- <-- edit this
begin
  delete from public.cinema_news_likes where user_id = uid;
  delete from public.poetry_wall_likes   where user_id = uid;
  delete from public.photo_gallery_likes where user_id = uid;
  delete from public.suggestion_votes    where user_id = uid;

  delete from public.cinema_news_likes
    where news_id in (select id from public.cinema_news where posted_by = uid);
  delete from public.poetry_wall_likes
    where poem_id in (select id from public.poetry_wall where posted_by = uid);
  delete from public.photo_gallery_likes
    where photo_id in (select id from public.photo_gallery where uploaded_by = uid);

  delete from public.cinema_news   where posted_by   = uid;
  delete from public.poetry_wall   where posted_by   = uid;
  delete from public.photo_gallery where uploaded_by = uid;
  delete from public.suggestions where user_id     = uid;

  update public.master_friends
    set is_registered = false,
        registered_profile_id = null,
        join_order = null
    where registered_profile_id = uid;

  delete from public.profiles where id = uid;
end $$;
