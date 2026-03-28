-- Align master_friends + profiles display name: Nagendrakumar Adapala

update public.master_friends
set display_name = 'Nagendrakumar Adapala'
where display_name in ('Nagendra', 'Nagendrakumar A');

update public.profiles
set full_name = 'Nagendrakumar Adapala'
where full_name in ('Nagendra', 'Nagendrakumar A');
