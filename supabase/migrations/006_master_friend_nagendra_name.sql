-- Rename Nagendra → Nagendrakumar A on existing databases

update public.master_friends
set display_name = 'Nagendrakumar A'
where display_name = 'Nagendra';
