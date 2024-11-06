"use client";

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, removeRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { 
  teamSchema, 
  playerSchema, 
  matchSchema, 
  setSchema, 
  playerStatSchema,
  substitutionSchema,
  scorePointSchema 
} from './schema';
import type { 
  Team, 
  Player, 
  Match, 
  Set, 
  PlayerStat,
  Substitution,
  ScorePoint 
} from '@/lib/supabase/types';

// Add plugins
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);

type DatabaseCollections = {
  teams: RxCollection<Team>;
  players: RxCollection<Player>;
  matches: RxCollection<Match>;
  sets: RxCollection<Set>;
  substitutions: RxCollection<Substitution>;
  score_points: RxCollection<ScorePoint>;
  player_stats: RxCollection<PlayerStat>;
};

export type VolleyballDatabase = RxDatabase<DatabaseCollections>;

let dbPromise: Promise<VolleyballDatabase> | null = null;

export const getDatabase = async (): Promise<VolleyballDatabase> => {
  if (dbPromise) return dbPromise;

  removeRxDatabase('volleystats_db', getRxStorageDexie());
  dbPromise = createRxDatabase<DatabaseCollections>({
    name: 'volleystats_db',
    storage: getRxStorageDexie(),
    multiInstance: true,
    ignoreDuplicate: true,
  }).then(async (db) => {
    // Create collections
    await db.addCollections({
      teams: {
        schema: teamSchema,
      },
      players: {
        schema: playerSchema,
      },
      matches: {
        schema: matchSchema,
      },
      sets: {
        schema: setSchema,
      },
      substitutions: {
        schema: substitutionSchema,
      },
      score_points: {
        schema: scorePointSchema,
      },
      player_stats: {
        schema: playerStatSchema,
      },
    });

    return db;
  });

  return dbPromise;
};