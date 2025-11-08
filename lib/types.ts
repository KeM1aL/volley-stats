import { PlayerPosition, PlayerRole } from "./enums";

export type Championship = {
  id: string; // UUID
  name: string;
  type: string;
  default_match_format: string; // UUID reference to match_format
  age_category: 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'U21' | 'senior';
  gender: 'female' | 'male' | 'mixte';
  season_id: string | null; // UUID reference to season
  ext_code: string | null;
  ext_source: string | null;
  created_at: string | null;
  updated_at: string | null;
  match_formats?: MatchFormat; // Joined relation
};

export type Season = {
  id: string; // UUID
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

export type MatchFormat = {
  id: string; // UUID
  description: string;
  format: '2x2' | '3x3' | '4x4' | '6x6';
  sets_to_win: number;
  rotation: boolean;
  point_by_set: number;
  point_final_set: number;
  decisive_point: boolean;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string | undefined;
  profile: Profile;
  teamMembers?: TeamMember[];
  clubMembers?: ClubMember[];
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  language: string;
};



export type Team = {
  id: string;
  name: string;
  club_id: string | null;
  clubs?: Club | null;
  championship_id: string | null; // UUID reference
  championships?: Championship;
  ext_code: string | null;
  ext_source: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type Club = {
  id: string;
  name: string;
  user_id: string;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  created_at: string;
  updated_at: string;
};

export type ClubMember = {
  id: string;
  club_id: string;
  clubs?: Club | null;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  teams?: Team | null;
  name: string;
  number: number;
  position: string;
  user_id?: string | null;
  role: string;
  avatar_url?: string | null;
  comments?: string | null;
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
  championship_id: string | null; // UUID reference
  season_id: string | null; // UUID reference
  match_format_id: string; // UUID reference
  match_formats?: MatchFormat; // Joined relation
  home_score: number | null;
  away_score: number | null;
  status: string;
  home_available_players: string[] | null;
  away_available_players: string[] | null;
  ext_code: string | null;
  ext_source: string | null;
  home_total: number | null;
  away_total: number | null;
  detailed_scores: string[] | null;
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
  first_lineup: { [key in PlayerPosition]?: string };
  current_lineup: { [key in PlayerPosition]?: string };
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
  current_rotation: { [key in PlayerPosition]?: string };
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
