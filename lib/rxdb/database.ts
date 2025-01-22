"use client";

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, removeRxDatabase, RxStorage, RxError } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import {
  teamSchema,
  playerSchema,
  matchSchema,
  setSchema,
  playerStatSchema,
  substitutionSchema,
  scorePointSchema,
  checkpointSchema
} from './schema';
import type {
  Team,
  Player,
  Match,
  Set,
  PlayerStat,
  Substitution,
  ScorePoint
} from '@/lib/types';
import { Checkpoint } from './types';
const inDevEnvironment = !!process && process.env.NODE_ENV === 'development';
// Add plugins
if (inDevEnvironment) {
  addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);

type DatabaseCollections = {
  checkpoints: RxCollection<Checkpoint>;
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

function getStorageKey(): string {
  const url_string = window.location.href;
  const url = new URL(url_string);
  let storageKey = url.searchParams.get('storage');
  if (!storageKey) {
    storageKey = 'dexie';
  }
  return storageKey;
}

/**
* Easy toggle of the storage engine via query parameter.
*/
export function getStorage(): RxStorage<any, any> {
  const storageKey = getStorageKey();
  if (storageKey === 'memory') {
    return getRxStorageMemory();
  } else if (storageKey === 'dexie') {
    return getRxStorageDexie();
  } else {
    throw new Error('storage key not defined ' + storageKey);
  }
}


/**
* In the e2e-test we get the database-name from the get-parameter
* In normal mode, the database name is 'heroesdb'
*/
export function getDatabaseName() {
  const url_string = window.location.href;
  const url = new URL(url_string);
  const dbNameFromUrl = url.searchParams.get('database');

  let ret = 'volleystats_db';
  if (dbNameFromUrl) {
    console.log('databaseName from url: ' + dbNameFromUrl);
    ret += dbNameFromUrl;
  }
  return ret;
}

export const getDatabase = async (): Promise<VolleyballDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = createRxDatabase<DatabaseCollections>({
    name: getDatabaseName(),
    storage: wrappedValidateAjvStorage({
      storage: getStorage()
    }),
    multiInstance: true,
    ignoreDuplicate: true,
  }).then(async (db) => {
    // Create collections
    try {
      await db.addCollections({
        checkpoints: {
          schema: checkpointSchema,
        },
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
    } catch (error) {
      if (error instanceof RxError) {
        const url_string = window.location.href;
        const url = new URL(url_string);
        const removeDbFlag = url.searchParams.get('remove-database');
        if (inDevEnvironment || removeDbFlag === 'true') {
          // removeRxDatabase(getDatabaseName(), getRxStorageDexie());
        }
      }
      throw error;
    }

    return db;
  });

  return dbPromise;
};