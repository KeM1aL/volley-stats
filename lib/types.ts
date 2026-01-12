import { PlayerPosition, PlayerRole } from "./enums";

export type Audited = {
  created_at?: string;
  updated_at?: string;
}

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
  match_formats?: MatchFormat; // Joined relation
} & Partial<Audited>;

export type Season = {
  id: string; // UUID
  name: string;
  start_date: string;
  end_date: string;
} & Partial<Audited>;

export type MatchFormat = {
  id: string; // UUID
  description: string | null;
  format: '2x2' | '3x3' | '4x4' | '6x6';
  sets_to_win: number;
  rotation: boolean;
  point_by_set: number;
  point_final_set: number;
  decisive_point: boolean;
} & Partial<Audited>;

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
  favorite_team_id: string | null;
  favorite_club_id: string | null;
  favorite_team?: Team | null;         // Joined relation
  favorite_club?: Club | null;         // Joined relation
};

export type TeamStatus = 'incomplete' | 'active' | 'archived';

export type Team = {
  id: string;
  name: string;
  status: TeamStatus;
  club_id: string | null;
  clubs?: Club | null;
  championship_id: string | null; // UUID reference
  championships?: Championship;
  ext_code: string | null;
  ext_source: string | null;
  created_at: string;
  updated_at?: string;
  user_id: string | null;
};

export type Club = {
  id: string;
  name: string;
  user_id: string;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
} & Partial<Audited>;

export type ClubMember = {
  id: string;
  club_id: string;
  clubs?: Club | null;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
} & Partial<Audited>;

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
} & Partial<Audited>;

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
} & Partial<Audited>;

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
} & Partial<Audited>;

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
} & Partial<Audited>;

export type Event = {
  id: string;
  match_id: string;
  set_id: string | null;
  team_id: string | null;
  event_type: 'substitution' | 'timeout' | 'injury' | 'sanction' | 'technical' | 'comment';
  timestamp: string;
  team: 'home' | 'away' | null;
  player_id: string | null;
  comment?: string | null;
  details: any;
  home_score?: number | null;
  away_score?: number | null;
  point_number?: number | null;
} & Partial<Audited>;

export type ScorePoint = {
  id: string;
  match_id: string;
  set_id: string;
  point_number: number;
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
} & Partial<Audited>;

export type PlayerStat = {
  id: string;
  match_id: string;
  set_id: string;
  player_id: string;
  team_id: string;
  position: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | null;
  stat_type: 'serve' | 'spike' | 'block' | 'reception' | 'defense';
  result: 'success' | 'error' | 'good' | 'bad';
} & Partial<Audited>;

// Sync-related types for offline queue management

export type SyncQueueItem = {
  id: string;
  collection_name: string;
  document_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any; // JSON object containing the document data
  status: 'pending' | 'processing' | 'failed';
  retry_count: number;
  last_error: string | null;
  processed_at: string | null;
} & Partial<Audited>;

export type FailedSyncItem = {
  id: string;
  collection_name: string;
  document_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  retry_count: number;
  last_error: string | null;
  failed_at: string;
} & Partial<Audited>;

export type SyncMetadata = {
  id: string;
  collection_name: string;
  last_pull_at: string | null;
  last_push_at: string | null;
  last_sync_success: boolean;
  last_sync_error: string | null;
} & Partial<Audited>;
