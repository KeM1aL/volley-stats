-- Create tables for the volleyball statistics app
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter publication supabase_realtime add table "public"."teams";

create table if not exists public.players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) not null,
  name text not null,
  number integer not null,
  role text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter publication supabase_realtime add table "public"."players";

create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  date timestamp with time zone not null,
  location text,
  home_team_id uuid references public.teams(id) not null,
  away_team_id uuid references public.teams(id) not null,
  home_score integer default 0 not null,
  away_score integer default 0 not null,
  status text default 'upcoming' not null,
  home_available_players uuid[] default array[]::uuid[],
  away_available_players uuid[] default array[]::uuid[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint status_check check (status in ('upcoming', 'live', 'completed'))
);

alter publication supabase_realtime add table "public"."matches";

create table if not exists public.sets (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_number integer not null,
  home_score integer default 0 not null,
  away_score integer default 0 not null,
  status text default 'upcoming' not null,
  first_server_team_id uuid references public.teams(id) not null,
  server_team_id uuid references public.teams(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  current_lineup jsonb not null default '{}'::jsonb,
  first_lineup jsonb not null default '{}'::jsonb,
  player_roles jsonb not null default '{}'::jsonb,
  constraint status_check check (status in ('upcoming', 'live', 'completed')),
);

alter publication supabase_realtime add table "public"."sets";

 create table if not exists public.substitutions (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  team_id uuid references public.teams(id) not null,
  set_id uuid references public.sets(id) not null,
  player_out_id uuid references public.players(id) not null,
  player_in_id uuid references public.players(id) not null,
  position text not null,
  comments text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint position_check check (position in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6'))
);

alter publication supabase_realtime add table "public"."substitutions";

create table if not exists public.score_points (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_id uuid references public.sets(id) not null,
  player_stat_id uuid references public.player_stats(id),
  scoring_team_id uuid references public.teams(id) not null,
  action_team_id uuid references public.teams(id) not null,
  result text not null check (result in ('success', 'error')),
  point_type text not null check (point_type in ('serve', 'spike', 'block', 'reception', 'defense', 'unknown')),
  player_id uuid references public.players(id),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  home_score integer not null,
  away_score integer not null,
  current_rotation jsonb not null,
);

alter publication supabase_realtime add table "public"."score_points";

create table if not exists public.player_stats (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) not null,
  set_id uuid references public.sets(id) not null,
  team_id uuid references public.teams(id) not null,
  player_id uuid references public.players(id) not null,
  position text not null check (position in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6')),
  stat_type text not null,
  result text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint stat_type_check check (stat_type in ('serve', 'spike', 'block', 'reception', 'defense')),
  constraint result_check check (result in ('success', 'error', 'good', 'bad'))
);

alter publication supabase_realtime add table "public"."player_stats";

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sets_updated_at
    BEFORE UPDATE ON public.sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_substitutions_updated_at
    BEFORE UPDATE ON public.substitutions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_score_points_updated_at
    BEFORE UPDATE ON public.score_points
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at
    BEFORE UPDATE ON public.player_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for timestamp columns
CREATE INDEX idx_teams_timestamps ON public.teams (created_at, updated_at);
CREATE INDEX idx_players_timestamps ON public.players (created_at, updated_at);
CREATE INDEX idx_matches_timestamps ON public.matches (created_at, updated_at);
CREATE INDEX idx_sets_timestamps ON public.sets (created_at, updated_at);
CREATE INDEX idx_substitutions_timestamps ON public.substitutions (created_at, updated_at);
CREATE INDEX idx_score_points_timestamps ON public.score_points (created_at, updated_at);
CREATE INDEX idx_player_stats_timestamps ON public.player_stats (created_at, updated_at);

-- Set up row level security
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sets enable row level security;
alter table public.substitutions enable row level security;
alter table public.score_points enable row level security;
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

-- Sets policies
create policy "Users can manage sets for their matches"
  on public.sets for all
  using (exists (
    select 1 from public.matches
    join public.teams on teams.id = matches.home_team_id or teams.id = matches.away_team_id
    where matches.id = sets.match_id
    and teams.user_id = auth.uid()
  ));

-- Substitutions policies
create policy "Users can manage substitutions for their matches"
  on public.substitutions for all
  using (exists (
    select 1 from public.matches
    join public.teams on teams.id = matches.home_team_id or teams.id = matches.away_team_id
    where matches.id = substitutions.match_id
    and teams.user_id = auth.uid()
  ));

-- Score points policies
create policy "Users can manage score points for their matches"
  on public.score_points for all
  using (exists (
    select 1 from public.matches
    join public.teams on teams.id = matches.home_team_id or teams.id = matches.away_team_id
    where matches.id = score_points.match_id
    and teams.user_id = auth.uid()
  ));

  -- Score points policies
create policy "Users can manage player stats for their matches"
  on public.player_stats for all
  using (exists (
    select 1 from public.matches
    join public.teams on teams.id = matches.home_team_id or teams.id = matches.away_team_id
    where matches.id = player_stats.match_id
    and teams.user_id = auth.uid()
  ));

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