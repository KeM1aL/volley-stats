import { randomUUID } from "node:crypto";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { setupCollections, type DatabaseCollections } from "@/lib/rxdb/collections";

/** A fresh in-memory database with the app's collections, hooks and conflict handlers. */
export async function createTestDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: `test_${randomUUID().replace(/-/g, "")}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    multiInstance: false,
    localDocuments: true,
    allowSlowCount: true,
  });
  const pending = await setupCollections(db);
  return { db, pending };
}
