-- Create tables for the volleyball statistics app
create table public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) not null,
  name text not null,
  number integer not null,
  position text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create storage bucket for player avatars
insert into storage.buckets (id, name, public) 
values ('player-avatars', 'player-avatars', true);

-- Set up storage policies
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'player-avatars' );

create policy "Users can upload avatar images"
  on storage.objects for insert
  with check (
    bucket_id = 'player-avatars' AND
    auth.role() = 'authenticated'
  );

create policy "Users can update their avatar images"
  on storage.objects for update
  using (
    bucket_id = 'player-avatars' AND
    auth.role() = 'authenticated'
  );

create policy "Users can delete their avatar images"
  on storage.objects for delete
  using (
    bucket_id = 'player-avatars' AND
    auth.role() = 'authenticated'
  );

-- Rest of the schema remains unchanged
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  date timestamp with time zone not null,
  location text,
  home_team_id uuid references public.teams(id) not null,
  away_team_id uuid references public.teams(id) not null,
  home_score integer default 0 not null,
  away_score integer default 0 not null,
  status text default 'upcoming' not null,
  available_players uuid[] default array[]::uuid[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint status_check check (status in ('upcoming', 'live', 'completed'))
);

create table public.sets (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_number integer not null,
  home_score integer default 0 not null,
  away_score integer default 0 not null,
  status text default 'upcoming' not null,
  current_lineup jsonb not null default '{
    "position1": null,
    "position2": null,
    "position3": null,
    "position4": null,
    "position5": null,
    "position6": null
  }',
  constraint status_check check (status in ('upcoming', 'live', 'completed'))
);

create table public.substitutions (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_id uuid references public.sets(id) not null,
  player_out_id uuid references public.players(id) not null,
  player_in_id uuid references public.players(id) not null,
  position integer not null check (position between 1 and 6),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.score_points (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_id uuid references public.sets(id) not null,
  scoring_team text not null check (scoring_team in ('home', 'away')),
  point_type text not null check (point_type in ('serve', 'spike', 'block', 'opponent_error')),
  player_id uuid references public.players(id),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  home_score integer not null,
  away_score integer not null,
  current_rotation jsonb not null
);

create table public.player_stats (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_id uuid references public.sets(id) not null,
  player_id uuid references public.players(id) not null,
  stat_type text not null,
  result text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint stat_type_check check (stat_type in ('serve', 'attack', 'block', 'reception')),
  constraint result_check check (result in ('success', 'error', 'attempt'))
);