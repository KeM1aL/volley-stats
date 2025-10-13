import { PlayerPosition, PlayerRole } from "./enums";

export type Championship = {
  id: number;
  name: string;
  type: string;
  metadata: string;
  default_match_format: number;
  format: '4x4' | '6x6';
  age_category: 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'U21' | 'senior';
  gender: 'female' | 'male';
  created_at: string;
  updated_at: string;
};

export type Season = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

export type MatchFormat = {
  id: number;
  description: string;
  sets_to_win: number;
  rotation: boolean;
  point_by_set: number;
  point_final_set: number;
  decisive_point: boolean;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  name: string;
  championship_id: number | null;
  championship?: Championship;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number;
  role: PlayerRole;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Match = {
  away_team?: Team | null;
  home_team?: Team | null;
  id: string;
  date: string;
  location: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
  home_available_players: string[] | null;
  away_available_players: string[] | null;
  created_at: string;
  updated_at: string;
};

export type Set = {
  id: string;
  match_id: string;
  set_number: number;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
  first_server_team_id: string;
  server_team_id: string;
  first_lineup: { [key in PlayerPosition]: string };
  current_lineup: { [key in PlayerPosition]: string };
  player_roles: { [key: string]: PlayerRole };
  created_at: string;
  updated_at: string;
};

export type Substitution = {
  id: string;
  match_id: string;
  team_id: string;
  set_id: string;
  player_out_id: string;
  player_in_id: string;
  position: string;
  comments: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  team_id: string;
  match_id: string;
  set_id: string;
  home_score: number;
  away_score: number;
  type: string;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type ScorePoint = {
  id: string;
  match_id: string;
  set_id: string;
  player_stat_id: string | null;
  scoring_team_id: string;
  point_type: 'serve' | 'spike' | 'block' | 'reception' | 'defense' | 'unknown';
  action_team_id: string;
  result: 'success' | 'error';
  player_id: string | null;
  timestamp: string;
  home_score: number;
  away_score: number;
  current_rotation: { [key in PlayerPosition]: string };
  created_at: string;
  updated_at: string;
};

export type PlayerStat = {
  id: string;
  match_id: string;
  set_id: string;
  player_id: string;
  team_id: string;
  position: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | null;
  stat_type: 'serve' | 'spike' | 'block' | 'reception' | 'defense';
  result: 'success' | 'error' | 'good' | 'bad';
  created_at: string;
  updated_at: string;
};