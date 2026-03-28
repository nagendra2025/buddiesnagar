-- BuddyNagar — refresh master_friends display names + add buddies (safe on existing DBs)

update public.master_friends
set display_name = 'Harishkumar K'
where display_name = 'Harish';

update public.master_friends
set display_name = 'Sreekanth C'
where display_name = 'Sree';

update public.master_friends
set display_name = 'VidyaSagar P'
where display_name = 'VidyaSagar';

insert into public.master_friends (display_name, is_registered)
select v.name, false
from (values
  ('Khader Basha'),
  ('Srini Pen'),
  ('Sreenu Bandi')
) as v(name)
where not exists (
  select 1 from public.master_friends mf where mf.display_name = v.name
);
