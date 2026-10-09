-- Per-match pulls filter on match_id and order by (_modified, id); get_match_scorer scans by match_id.
CREATE INDEX IF NOT EXISTS sets_match_id_modified_idx ON public.sets (match_id, _modified, id);
CREATE INDEX IF NOT EXISTS score_points_match_id_modified_idx ON public.score_points (match_id, _modified, id);
CREATE INDEX IF NOT EXISTS player_stats_match_id_modified_idx ON public.player_stats (match_id, _modified, id);
CREATE INDEX IF NOT EXISTS events_match_id_modified_idx ON public.events (match_id, _modified, id);
