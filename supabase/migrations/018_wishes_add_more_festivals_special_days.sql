-- Add more wishes: Good Friday, Easter, and additional festivals/special days.
-- Idempotent: safe to run multiple times.
--
-- Note: some events (e.g., Easter/Eid/Thanksgiving) move by year on Gregorian calendar.
-- Keep is_recurring=true for spotlight convenience and update month/day when needed.

insert into public.wishes (
  type,
  title,
  message,
  banner_color,
  icon_emoji,
  wish_date,
  is_recurring,
  is_active
)
select
  v.type,
  v.title,
  v.message,
  v.color,
  v.emoji,
  v.d::date,
  true,
  true
from (values
  ('festival', 'Maha Shivaratri',
   'A night of prayer and stillness — may peace and strength stay with everyone.',
   '#EDE7F6', '🕉️', '2000-02-26'),
  ('festival', 'Good Friday',
   'A day of reflection, compassion, and grace. Wishing everyone peace.',
   '#ECEFF1', '✝️', '2000-04-18'),
  ('festival', 'Easter',
   'Hope renewed and hearts uplifted — happy Easter to all buddies.',
   '#FFF3E0', '🐣', '2000-04-20'),
  ('festival', 'Eid al-Fitr',
   'Eid Mubarak! May this day bring joy, kindness, and togetherness.',
   '#E8F5E9', '🌙', '2000-03-31'),
  ('festival', 'Eid al-Adha',
   'Eid al-Adha Mubarak — wishing you peace, gratitude, and blessings.',
   '#E0F7FA', '🕌', '2000-06-07'),
  ('special', 'Mother''s Day',
   'To all moms and mother-figures — thank you for endless love.',
   '#FCE4EC', '💖', '2000-05-12'),
  ('special', 'Father''s Day',
   'To all dads and father-figures — thank you for your strength and care.',
   '#E3F2FD', '👔', '2000-06-16'),
  ('special', 'World Environment Day',
   'Small green steps matter — happy Environment Day.',
   '#E8F5E9', '🌍', '2000-06-05'),
  ('special', 'Thanksgiving',
   'Grateful hearts, full plates, and warm company. Happy Thanksgiving.',
   '#FFF8E1', '🦃', '2000-11-28'),
  ('special', 'New Year''s Eve',
   'Counting down with laughter and memories — cheers to what''s next.',
   '#E8EAF6', '🎉', '2000-12-31')
) as v(type, title, message, color, emoji, d)
where not exists (
  select 1 from public.wishes w where w.title = v.title
);
