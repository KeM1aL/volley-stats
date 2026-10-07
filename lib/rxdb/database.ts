"use client";

import { addRxPlugin, createRxDatabase, removeRxDatabase, RxError, type RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { setupCollections, type DatabaseCollections, type LocalDatabase } from "./collections";
import type { PendingChanges } from "./sync/pending-changes";
import { SyncManager } from "./sync/manager";
import { supabase } from "@/lib/supabase/client";

export type { DatabaseCollections } from "./collections";

const inDevEnvironment = !!process && process.env.NODE_ENV === "development";
const devModePluginPromise = inDevEnvironment
  ? import("rxdb/plugins/dev-mode").then(({ RxDBDevModePlugin }) => {
      console.debug("Enabling RxDB Dev Mode Plugin");
      addRxPlugin(RxDBDevModePlugin);
    })
  : Promise.resolve();

export type VolleyballDatabase = LocalDatabase & {
  syncManager: SyncManager;
  pendingChanges: PendingChanges;
};

let dbPromise: Promise<VolleyballDatabase> | null = null;

// RxDB major versions do not share an on-disk format. Bump DB_GENERATION when
// upgrading RxDB's major version: databases from older generations are deleted
// and the live match re-syncs from Supabase (syncMatch).
const DB_BASE_NAME = "volleystats_db";
const DB_GENERATION = "v17";
const DB_CURRENT_NAME = `${DB_BASE_NAME}_${DB_GENERATION}`;

async function deleteLegacyDatabases(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  const legacyNames = (await indexedDB.databases())
    .map((info) => info.name)
    .filter((name): name is string => !!name && name.includes(DB_BASE_NAME) && !name.includes(DB_CURRENT_NAME));
  await Promise.all(
    legacyNames.map(
      (name) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = request.onerror = request.onblocked = () => resolve();
        })
    )
  );
}

function getStorageKey(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("storage") || "dexie";
}

/**
 * Easy toggle of the storage engine via query parameter.
 */
export function getStorage(): RxStorage<any, any> {
  const storageKey = getStorageKey();
  if (storageKey === "memory") return getRxStorageMemory();
  if (storageKey === "dexie") return getRxStorageDexie();
  // Error identifier maps to translation key: errors.database.storageKeyNotDefined
  throw new Error("storageKeyNotDefined");
}

/**
 * In the e2e-test we get the database-name from the get-parameter
 * In normal mode, the database name is 'volleystats_db_v17' (DB_CURRENT_NAME)
 */
export function getDatabaseName() {
  const url = new URL(window.location.href);
  const dbNameFromUrl = url.searchParams.get("database");
  let ret = DB_CURRENT_NAME;
  if (dbNameFromUrl) {
    console.log("databaseName from url: " + dbNameFromUrl);
    ret += dbNameFromUrl;
  }
  return ret;
}

// The shared promise is assigned synchronously, before any await, so concurrent
// callers always get the same database instead of racing to create two.
export const getDatabase = (): Promise<VolleyballDatabase> => {
  if (!dbPromise) dbPromise = createDatabase();
  return dbPromise;
};

const createDatabase = async (): Promise<VolleyballDatabase> => {
  // Ensure dev mode plugin is loaded before creating database
  await devModePluginPromise;

  try {
    await deleteLegacyDatabases();
  } catch (error) {
    console.warn("Could not delete legacy local databases:", error);
  }

  return createRxDatabase<DatabaseCollections>({
    name: getDatabaseName(),
    storage: wrappedValidateAjvStorage({ storage: getStorage() }),
    multiInstance: true,
    ignoreDuplicate: false,
    localDocuments: true,
  }).then(async (db) => {
    try {
      const pendingChanges = await setupCollections(db);
      const syncManager = new SyncManager(db, supabase);
      await syncManager.initialize();
      Object.assign(db, { syncManager, pendingChanges });
    } catch (error) {
      console.error("Error creating RxDB collections:", error);

      if (error instanceof RxError) {
        const url = new URL(window.location.href);
        const removeDbFlag = url.searchParams.get("remove-database");

        // Check if it's a schema version conflict or database corruption
        const isSchemaError =
          error.code === "SC13" || // schema validation failed
          error.code === "DB1" || // database version mismatch
          (error as any).name === "OpenFailedError" ||
          error.message?.includes("schema") ||
          error.message?.includes("version");

        if (isSchemaError) {
          console.warn("Schema version conflict detected. Database needs to be reset.");

          // Auto-remove in development or if flag is set
          if (inDevEnvironment || removeDbFlag === "true") {
            console.log("Removing old database and reinitializing...");
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
};
