import { RxCollection } from 'rxdb';
import { CollectionName } from '../rxdb/schema';
import { Team, Player, Match, Set, PlayerStat, ScorePoint } from '../supabase/types';

export type DataSource = 'supabase' | 'rxdb';

export interface DataLoadingState {
  isLoading: boolean;
  error: Error | null;
  dataSource: DataSource;
}

export interface DataOperationResult<T> {
  data: T | null;
  error: Error | null;
  source: DataSource;
}

export interface DataCollections {
  teams: RxCollection<Team>;
  players: RxCollection<Player>;
  matches: RxCollection<Match>;
  sets: RxCollection<Set>;
  score_points: RxCollection<ScorePoint>;
  player_stats: RxCollection<PlayerStat>;
}

export interface DataLoadingOptions {
  forceSource?: DataSource;
  bypassCache?: boolean;
  retryAttempts?: number;
}