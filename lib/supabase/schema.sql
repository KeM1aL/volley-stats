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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.matches (
  id uuid default gen_random_uuid() primary key,
  date timestamp with time zone not null,
  home_team_id uuid references public.teams(id) not null,
  away_team_id uuid references public.teams(id) not null,
  home_score integer default 0 not null,
  away_score integer default 0 not null,
  status text default 'upcoming' not null,
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
  constraint status_check check (status in ('upcoming', 'live', 'completed'))
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

-- Set up row level security
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sets enable row level security;
alter table public.player_stats enable row level security;

-- Create policies
create policy "Users can view their own teams"
  on public.teams for select
  using (auth.uid() = user_id);

create policy "Users can insert their own teams"
  on public.teams for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own teams"
  on public.teams for update
  using (auth.uid() = user_id);

create policy "Users can delete their own teams"
  on public.teams for delete
  using (auth.uid() = user_id);

-- Players policies
create policy "Users can view players from their teams"
  on public.players for select
  using (exists (
    select 1 from public.teams
    where teams.id = players.team_id
    and teams.user_id = auth.uid()
  ));

create policy "Users can manage players from their teams"
  on public.players for all
  using (exists (
    select 1 from public.teams
    where teams.id = players.team_id
    and teams.user_id = auth.uid()
  ));

-- Matches policies
create policy "Users can view matches involving their teams"
  on public.matches for select
  using (exists (
    select 1 from public.teams
    where (teams.id = matches.home_team_id or teams.id = matches.away_team_id)
    and teams.user_id = auth.uid()
  ));

create policy "Users can manage matches involving their teams"
  on public.matches for all
  using (exists (
    select 1 from public.teams
    where (teams.id = matches.home_team_id or teams.id = matches.away_team_id)
    and teams.user_id = auth.uid()
  ));