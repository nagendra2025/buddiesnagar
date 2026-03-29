-- Add master friend: Nagendrakumar A (idempotent)

insert into public.master_friends (display_name, is_registered)
select v.name, false
from (values
  ('Nagendrakumar A')
) as v(name)
where not exists (
  select 1 from public.master_friends mf where mf.display_name = v.name
);
