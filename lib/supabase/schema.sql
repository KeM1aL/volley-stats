-- Enable RLS
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sets enable row level security;
alter table public.substitutions enable row level security;
alter table public.score_points enable row level security;
alter table public.player_stats enable row level security;

-- Add updated_at columns and triggers
ALTER TABLE public.teams 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.players 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.matches 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.sets 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.substitutions 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.score_points 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.player_stats 
ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

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