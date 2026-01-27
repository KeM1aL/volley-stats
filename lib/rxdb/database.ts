"use client";

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, removeRxDatabase, RxStorage, RxError } from 'rxdb';
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import {
  teamSchema,
  playerSchema,
  matchSchema,
  setSchema,
  playerStatSchema,
  scorePointSchema,
  championshipSchema,
  eventSchema,
  matchFormatSchema,
  seasonSchema,
  clubSchema,
  clubMemberSchema,
  CollectionName
} from './schema';
import type {
  Team,
  TeamMember,
  Match,
  Set,
  PlayerStat,
  ScorePoint,
  Championship,
  MatchFormat,
  Season,
  Club,
  ClubMember,
  Event
} from '@/lib/types';
import { SyncManager } from './sync/manager';
import { supabase } from '@/lib/supabase/client';
const inDevEnvironment = !!process && process.env.NODE_ENV === 'development';
// Add plugins
const devModePluginPromise = inDevEnvironment
  ? import('rxdb/plugins/dev-mode').then(({ RxDBDevModePlugin }) => {
      console.debug('Enabling RxDB Dev Mode Plugin');
      addRxPlugin(RxDBDevModePlugin);
    })
  : Promise.resolve();

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBLocalDocumentsPlugin);

export type DatabaseCollections = {
  championships: RxCollection<Championship>;
  match_formats: RxCollection<MatchFormat>;
  clubs: RxCollection<Club>;
  club_members: RxCollection<ClubMember>;
  seasons: RxCollection<Season>;
  events: RxCollection<Event>;
  teams: RxCollection<Team>;
  team_members: RxCollection<TeamMember>;
  matches: RxCollection<Match>;
  sets: RxCollection<Set>;
  score_points: RxCollection<ScorePoint>;
  player_stats: RxCollection<PlayerStat>;
};

export type VolleyballDatabase = RxDatabase<DatabaseCollections> & {
  syncManager: SyncManager;
};

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

  // Ensure dev mode plugin is loaded before creating database
  await devModePluginPromise;

  dbPromise = createRxDatabase<DatabaseCollections>({
    name: getDatabaseName(),
    storage: wrappedValidateAjvStorage({
      storage: getStorage()
    }),
    multiInstance: true,
    ignoreDuplicate: false,
    localDocuments: true
  }).then(async (db) => {
    // Create collections
    try {
      await db.addCollections({
        championships: {
          schema: championshipSchema,
        },
        match_formats: {
          schema: matchFormatSchema,
        },
        clubs: {
          schema: clubSchema,
        },
        club_members: {
          schema: clubMemberSchema,
        },
        seasons: {
          schema: seasonSchema,
        },
        teams: {
          schema: teamSchema,
        },
        team_members: {
          schema: playerSchema,
        },
        matches: {
          schema: matchSchema,
        },
        sets: {
          schema: setSchema,
        },
        events: {
          schema: eventSchema,
        },
        score_points: {
          schema: scorePointSchema,
        },
        player_stats: {
          schema: playerStatSchema,
        },
      });

      Object.values(db.collections as DatabaseCollections).forEach((col) => {
        col.preInsert((data) => {
          const now = new Date().toISOString();
          if (!data.created_at) data.created_at = now;
          if (!data.updated_at) data.updated_at = now;
        }, false);

        col.preSave((data) => {
          if (!data.updated_at) data.updated_at = new Date().toISOString();
        }, false);
      });

      // Initialize Sync
      const syncManager = new SyncManager(db, supabase);
      await syncManager.initialize();
      (db as any).syncManager = syncManager;

    } catch (error) {
      console.error('Error creating RxDB collections:', error);

      if (error instanceof RxError) {
        const url_string = window.location.href;
        const url = new URL(url_string);
        const removeDbFlag = url.searchParams.get('remove-database');

        // Check if it's a schema version conflict or database corruption
        const isSchemaError = error.code === 'SC13' || // schema validation failed
                              error.code === 'DB1' || // database version mismatch
                              (error as any).name === 'OpenFailedError' ||
                              error.message?.includes('schema') ||
                              error.message?.includes('version');

        if (isSchemaError) {
          console.warn('Schema version conflict detected. Database needs to be reset.');

          // Auto-remove in development or if flag is set
          if (inDevEnvironment || removeDbFlag === 'true') {
            console.log('Removing old database and reinitializing...');
            await removeRxDatabase(getDatabaseName(), getRxStorageDexie());

            // Reset the promise to allow recreation
            dbPromise = null;

            // Recursively retry database creation
            return getDatabase();
          }
        }
      }
      throw error;
    }

    return db as VolleyballDatabase;
  });

  return dbPromise;
};
