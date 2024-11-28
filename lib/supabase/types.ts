import { PlayerPosition } from "../types";

export type Team = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number;
  role: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Match = {
  away_team?: Team;
  home_team?: Team;
  id: string;
  date: string;
  location: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
  home_available_players: string[];
  away_available_players: string[];
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
  first_server: 'home' | 'away';
  server: 'home' | 'away';
  first_lineup: { [key in PlayerPosition]: string };
  current_lineup: { [key in PlayerPosition]: string };
  created_at: string;
  updated_at: string;
};

export type Substitution = {
  id: string;
  match_id: string;
  set_id: string;
  player_out_id: string;
  player_in_id: string;
  position: number;
  timestamp: string;
  created_at: string;
  updated_at: string;
};

export type ScorePoint = {
  id: string;
  match_id: string;
  set_id: string;
  scoring_team: 'home' | 'away';
  point_type: 'serve' | 'spike' | 'block' | 'reception' | 'unknown';
  player_id: string | null;
  timestamp: string;
  home_score: number;
  away_score: number;
  current_rotation: {
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    p5: string;
    p6: string;
  };
  created_at: string;
  updated_at: string;
};

export type PlayerStat = {
  id: string;
  match_id: string;
  set_id: string;
  player_id: string;
  stat_type: 'serve' | 'spike' | 'block' | 'reception';
  result: 'success' | 'error' | 'attempt';
  created_at: string;
  updated_at: string;
};