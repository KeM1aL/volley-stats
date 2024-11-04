export type Team = {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  number: number;
  position: string;
  created_at: string;
};

export type Match = {
  id: string;
  date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
  created_at: string;
};

export type Set = {
  id: string;
  match_id: string;
  set_number: number;
  home_score: number;
  away_score: number;
  status: 'upcoming' | 'live' | 'completed';
};

export type PlayerStat = {
  id: string;
  match_id: string;
  set_id: string;
  player_id: string;
  stat_type: 'serve' | 'attack' | 'block' | 'reception';
  result: 'success' | 'error' | 'attempt';
  created_at: string;
};