-- BuddyNagar — Indian festivals & special days for Today's spotlight (wishes table)
--
-- HOW SPOTLIGHT USES wish_date (see src/components/sections/SpotlightSection.tsx):
--
--   • is_recurring = TRUE  → match TODAY using MONTH and DAY only. The YEAR in the
--     database is IGNORED. Year 2000 is a placeholder: SQL date columns need a year;
--     we picked 2000 as a neutral anchor. You do NOT need to change it to 2026.
--
--   • is_recurring = FALSE → one-off wish: match full calendar date (year + month + day).
--
-- Buddy BIRTHDAYS in spotlight come from public.profiles (birthday_month, birthday_day),
-- not from this table. wishes is only for festivals / national days / special messages.
--
-- Lunar festivals that move on the Gregorian calendar: adjust wish_date month/day in
-- Supabase when needed, or add one-off rows with is_recurring = false and the real date.

insert into public.wishes (type, title, message, banner_color, icon_emoji, wish_date, is_recurring, is_active)
select v.type, v.title, v.message, v.color, v.emoji, v.d::date, true, true
from (values
  ('special', 'New Year''s Day',
   'Fresh starts and good vibes to the whole Kadapa gang.',
   '#E3F2FD', '🎆', '2000-01-01'),
  ('festival', 'Makar Sankranti & Pongal',
   'Harvest gratitude, sugarcane sweetness, and kite skies — happy Sankranti & Pongal.',
   '#FFF8E1', '🪁', '2000-01-14'),
  ('national', 'Republic Day',
   'Honouring the Constitution — proud to be Indian.',
   '#FFEBEE', '🇮🇳', '2000-01-26'),
  ('special', 'International Women''s Day',
   'Celebrating the women in our lives and everywhere.',
   '#FCE4EC', '💐', '2000-03-08'),
  ('festival', 'Holi',
   'Festival of colours — splash joy, forgive old grudges, eat gujiya.',
   '#F8BBD0', '🎨', '2000-03-14'),
  ('festival', 'Ugadi & Gudi Padwa',
   'Telugu New Year (Ugadi) and Gudi Padwa — new ledger, new hope.',
   '#E8F5E9', '🌿', '2000-03-25'),
  ('festival', 'Ram Navami',
   'Birth anniversary of Lord Rama — peace and dharma to all.',
   '#FFF3E0', '🙏', '2000-04-06'),
  ('national', 'Ambedkar Jayanti',
   'Remembering Dr. B.R. Ambedkar — liberty, equality, fraternity.',
   '#E3F2FD', '📘', '2000-04-14'),
  ('special', 'Labour Day',
   'Solidarity with every worker who keeps the world turning.',
   '#F3E5F5', '⚒️', '2000-05-01'),
  ('special', 'International Yoga Day',
   'Stretch, breathe, be kind to your body — happy Yoga Day.',
   '#E0F2F1', '🧘', '2000-06-21'),
  ('festival', 'Guru Purnima',
   'Gratitude to teachers and guides who light the way.',
   '#F1F8E9', '📿', '2000-07-21'),
  ('national', 'Independence Day',
   'Seventy‑plus years of freedom — Jai Hind!',
   '#FFEBEE', '🇮🇳', '2000-08-15'),
  ('festival', 'Raksha Bandhan',
   'Threads of love between siblings — happy Rakhi.',
   '#FCE4EC', '🧵', '2000-08-19'),
  ('festival', 'Krishna Janmashtami',
   'Birth of Lord Krishna — dahi handi, bhajans, and midnight joy.',
   '#E8EAF6', '🦚', '2000-08-26'),
  ('special', 'Teachers'' Day',
   'Thanking gurus — especially the ones who shaped us.',
   '#E3F2FD', '🍎', '2000-09-05'),
  ('festival', 'Ganesh Chaturthi',
   'Ganpati Bappa Morya — modaks, music, and togetherness.',
   '#FFF9C4', '🐘', '2000-09-07'),
  ('festival', 'Onam',
   'Harvest festival of Kerala — boat races, sadya, and King Mahabali.',
   '#E8F5E9', '🌺', '2000-09-10'),
  ('national', 'Gandhi Jayanti',
   'Remembering the Mahatma — truth and non‑violence.',
   '#E8F5E9', '🕊️', '2000-10-02'),
  ('festival', 'Dussehra (Vijayadashami)',
   'Good over evil — burn the Ravan within, celebrate victory.',
   '#FFF3E0', '🏹', '2000-10-12'),
  ('festival', 'Diwali',
   'Festival of lights — diyas, sweets, and homecoming.',
   '#FFF8E1', '🪔', '2000-11-08'),
  ('special', 'Children''s Day',
   'Chacha Nehru''s birthday — the future belongs to the young.',
   '#F3E5F5', '🎈', '2000-11-14'),
  ('festival', 'Guru Nanak Jayanti',
   'Gurpurab — light, langar, and equality before the One.',
   '#E8EAF6', '🕯️', '2000-11-15'),
  ('festival', 'Christmas',
   'Peace, cake, and carols — merry Christmas, buddies.',
   '#E8F5E9', '🎄', '2000-12-25')
) as v(type, title, message, color, emoji, d)
where not exists (
  select 1 from public.wishes w where w.title = v.title
);
