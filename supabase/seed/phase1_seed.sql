-- BuddyNagar Phase 1 seed (run after migration). Safe to re-run.

insert into public.master_friends (display_name, is_registered)
select v.name, false
from (values
  ('Nagendrakumar Adapala'),
  ('Harishkumar K'),
  ('Sreekanth C'),
  ('VidyaSagar P'),
  ('Khader Basha'),
  ('Srini Pen'),
  ('Sreenu Bandi')
) as v(name)
where not exists (
  select 1 from public.master_friends mf where mf.display_name = v.name
);

insert into public.fun_facts (fact_text, category, show_date)
select v.fact, v.cat, null::date
from (values
  (
    'Telugu is one of the classical languages of India and is spoken by millions worldwide.',
    'telugu'
  ),
  (
    'Sachin Tendulkar scored his first international century at age 17.',
    'cricket'
  ),
  (
    'The human brain generates tens of thousands of thoughts per day — pick a happy one for a friend today.',
    'science'
  )
) as v(fact, cat)
where not exists (
  select 1 from public.fun_facts ff where ff.fact_text = v.fact
);

-- Sample wish (optional). Adjust wish_date to a real festival day for testing spotlight.
insert into public.wishes (type, title, message, banner_color, icon_emoji, wish_date, is_recurring, is_active)
select
  'festival',
  'Friendship Day',
  'Good friends are the family we choose — glad you are here.',
  '#FFF4E5',
  '🤝',
  (date_trunc('year', now())::date + interval '200 days')::date,
  true,
  true
where not exists (
  select 1 from public.wishes w where w.title = 'Friendship Day' and w.type = 'festival'
);
