-- Profile registration: first/last name, nickname, birth year (mandatory on new signups via RPC)

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists nickname text,
  add column if not exists birthday_year int;

alter table public.profiles
  drop constraint if exists profiles_birthday_year_chk;

alter table public.profiles
  add constraint profiles_birthday_year_chk
  check (
    birthday_year is null
    or (birthday_year >= 1900 and birthday_year <= extract(year from now())::int + 1)
  );

-- Best-effort backfill for existing profiles
update public.profiles
set
  first_name = coalesce(
    nullif(trim(first_name), ''),
    split_part(trim(full_name), ' ', 1)
  ),
  last_name = coalesce(
    nullif(trim(last_name), ''),
    nullif(
      trim(
        substring(
          trim(full_name)
          from length(split_part(trim(full_name), ' ', 1)) + 2
        )
      ),
      ''
    ),
    split_part(trim(full_name), ' ', 1)
  )
where coalesce(trim(first_name), '') = ''
   or coalesce(trim(last_name), '') = '';

update public.profiles
set nickname = coalesce(nullif(trim(nickname), ''), first_name)
where coalesce(trim(nickname), '') = '';

-- Replace complete_registration (expanded signature)

drop function if exists public.complete_registration(uuid, text, text, text, text, int, int);

create or replace function public.complete_registration(
  p_master_friend_id uuid,
  p_first_name text,
  p_last_name text,
  p_nickname text,
  p_phone text,
  p_city text,
  p_bio text,
  p_birthday_month int,
  p_birthday_day int,
  p_birthday_year int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mf public.master_friends%rowtype;
  next_join int;
  auth_email text;
  bio_trim text;
  fn text;
  ln text;
  nick text;
  full_nm text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'PROFILE_EXISTS';
  end if;

  select email::text into auth_email from auth.users where id = auth.uid();
  if auth_email is null or length(trim(auth_email)) = 0 then
    raise exception 'NO_EMAIL';
  end if;

  fn := trim(coalesce(p_first_name, ''));
  ln := trim(coalesce(p_last_name, ''));
  nick := trim(coalesce(p_nickname, ''));
  if length(fn) = 0 or length(ln) = 0 or length(nick) = 0 then
    raise exception 'INVALID_NAME';
  end if;

  if p_birthday_month is null
     or p_birthday_day is null
     or p_birthday_year is null
     or p_birthday_month < 1 or p_birthday_month > 12
     or p_birthday_day < 1 or p_birthday_day > 31
     or p_birthday_year < 1900
     or p_birthday_year > extract(year from now())::int + 1
  then
    raise exception 'INVALID_BIRTHDAY';
  end if;

  begin
    perform make_date(p_birthday_year, p_birthday_month, p_birthday_day);
  exception when others then
    raise exception 'INVALID_BIRTHDAY';
  end;

  select * into mf from public.master_friends where id = p_master_friend_id for update;
  if not found then
    raise exception 'INVALID_BUDDY';
  end if;
  if mf.is_registered then
    raise exception 'ALREADY_REGISTERED';
  end if;

  bio_trim := left(trim(coalesce(p_bio, '')), 120);
  full_nm := fn || ' ' || ln;

  select coalesce(max(join_order), 0) + 1 into next_join from public.profiles;

  insert into public.profiles (
    id, full_name, first_name, last_name, nickname, email, phone, city, bio,
    birthday_month, birthday_day, birthday_year, roles, join_order
  ) values (
    auth.uid(),
    full_nm,
    fn,
    ln,
    nick,
    lower(trim(auth_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(bio_trim, ''),
    p_birthday_month,
    p_birthday_day,
    p_birthday_year,
    array['member']::text[],
    next_join
  );

  update public.master_friends
  set
    is_registered = true,
    registered_profile_id = auth.uid(),
    join_order = next_join
  where id = p_master_friend_id;
end;
$$;

revoke all on function public.complete_registration(uuid, text, text, text, text, text, text, int, int, int) from public;
grant execute on function public.complete_registration(uuid, text, text, text, text, text, text, int, int, int) to authenticated;
