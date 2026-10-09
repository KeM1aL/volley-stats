import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRevision,
  flatCloneDocWithMeta,
  getComposedPrimaryKeyOfDocumentData,
  getDefaultRevision,
  getRxReplicationMetaInstanceSchema,
  hasEncryption,
  now,
  overwritable,
  type BulkWriteRow,
  type RxCollection,
  type RxDocumentData,
  type RxStorageReplicationMeta,
  type WithDeleted,
} from "rxdb";
import type { LocalDatabase } from "../collections";
import { pickSchemaFields } from "./helper";
import { matchReplicationIdentifier } from "./match-sync";
import type { PendingChange, PendingChanges } from "./pending-changes";
import { MATCH_COLLECTIONS, type MatchCollectionName } from "./types";

/** Ids per request when fetching the server's version of the rows (keeps the URL short). */
const FETCH_CHUNK = 100;

export interface DiscardSupersededOptions {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  pending: PendingChanges;
  deviceId: string;
  matchId: string;
}

/**
 * Taking scoring back (controller ruling for N1): this device's superseded changes to the match
 * (rows it recorded but never uploaded before another device took over) are discarded, so that the
 * device shows the match as the server has it. Each superseded row is replaced by the server's
 * version, or removed locally when the server doesn't have it; then the entries are deleted.
 *
 * Nothing of this may reach the server. The rows are written through the storage instance (no
 * hooks, so no pending entry), and the match's replication meta is set to the same state: RxDB's
 * upstream skips a row whose fork state equals its assumed master state, so the restarted
 * replication neither re-inserts a discarded row nor pushes its removal. The replications of the
 * match must be stopped while this runs (the claim is still "lost").
 *
 * Throws if the server can't be read; nothing local is changed for a table whose rows couldn't be fetched.
 */
export async function discardSupersededChanges({ db, client, pending, deviceId, matchId }: DiscardSupersededOptions): Promise<void> {
  const entries = await pending.list({ matchId, statuses: ["superseded"] });
  for (const table of MATCH_COLLECTIONS) {
    const tableEntries = entries.filter((entry) => entry.table_name === table);
    if (tableEntries.length === 0) continue;
    const collection = db[table] as unknown as RxCollection<any>;
    const ids = tableEntries.map((entry) => entry.doc_id);
    const serverDocs = await fetchServerDocs(client, collection, table, ids, deviceId);
    await alignRows(db, collection, matchReplicationIdentifier(table, matchId), ids, serverDocs);
    await pending.removeEntries(tableEntries.map((entry: PendingChange) => entry.id));
  }
}

async function fetchServerDocs(
  client: SupabaseClient<any>,
  collection: RxCollection<any>,
  table: MatchCollectionName,
  ids: string[],
  deviceId: string
): Promise<Map<string, WithDeleted<any>>> {
  const properties = collection.schema.jsonSchema.properties as Record<string, unknown>;
  const docs = new Map<string, WithDeleted<any>>();
  for (let start = 0; start < ids.length; start += FETCH_CHUNK) {
    const chunk = ids.slice(start, start + FETCH_CHUNK);
    const { data, error } = await client.from(table).select("*").in("id", chunk).setHeader("x-device-id", deviceId);
    if (error) throw error;
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      // Same shape as a pulled row (replication.ts rowToDoc).
      docs.set(String(row.id), { ...pickSchemaFields(row, properties), _deleted: !!row._deleted } as WithDeleted<any>);
    }
  }
  return docs;
}

/** Strips RxDB's bookkeeping fields, as the upstream does before comparing with the assumed master. */
function toDocState(doc: RxDocumentData<any>): WithDeleted<any> {
  const { _meta: _m, _rev: _r, _attachments: _a, ...state } = doc;
  return state as WithDeleted<any>;
}

async function alignRows(
  db: LocalDatabase,
  collection: RxCollection<any>,
  replicationIdentifier: string,
  ids: string[],
  serverDocs: Map<string, WithDeleted<any>>
): Promise<void> {
  const local = new Map(
    (await collection.storageInstance.findDocumentsById(ids, true)).map((doc) => [doc[collection.schema.primaryPath], doc])
  );
  const forkWrites: BulkWriteRow<any>[] = [];
  const finalStates: WithDeleted<any>[] = [];
  for (const id of ids) {
    const previous = local.get(id);
    const server = serverDocs.get(id);
    if (server) {
      forkWrites.push({
        previous,
        document: { ...server, _attachments: {}, _meta: { ...(previous?._meta ?? {}), lwt: now() }, _rev: previous?._rev ?? "" },
      });
      finalStates.push(server);
    } else if (previous) {
      // Never on the server: removed here only.
      if (!previous._deleted) forkWrites.push({ previous, document: { ...previous, _deleted: true } });
      finalStates.push({ ...toDocState(previous), _deleted: true });
    }
  }
  if (forkWrites.length > 0) {
    // The wrapped storage instance sets `_rev` and `_meta.lwt`; the collection sees the change (queries update).
    const result = await collection.storageInstance.bulkWrite(forkWrites, "sync-take-back");
    if (result.error.length > 0) throw new Error(`take back: could not write ${result.error.length} local row(s)`);
  }
  await writeAssumedMasterStates(db, collection, replicationIdentifier, finalStates);
}

/**
 * Writes the replication's "assumed master state" of these rows, as RxDB's getMetaWriteRow
 * (replication-protocol/meta-instance.ts) does after a push. The meta storage instance is the one
 * RxReplicationState opens for this collection and identifier (plugins/replication/index.ts).
 */
async function writeAssumedMasterStates(
  db: LocalDatabase,
  collection: RxCollection<any>,
  replicationIdentifier: string,
  states: WithDeleted<any>[]
): Promise<void> {
  if (states.length === 0) return;
  const collectionName =
    "rx-replication-meta-" + (await db.hashFunction([collection.name, replicationIdentifier].join("-")));
  const schema = getRxReplicationMetaInstanceSchema<any, unknown>(
    collection.schema.jsonSchema,
    hasEncryption(collection.schema.jsonSchema)
  );
  const metaInstance = await db.storage.createStorageInstance<RxStorageReplicationMeta<any, unknown>>({
    databaseName: db.name,
    collectionName,
    databaseInstanceToken: db.token,
    multiInstance: db.multiInstance,
    options: {},
    schema,
    password: db.password,
    devMode: overwritable.isDevMode(),
  });
  try {
    const primaryPath = collection.schema.primaryPath as string;
    const metaIds = states.map((state) =>
      getComposedPrimaryKeyOfDocumentData(schema, { itemId: state[primaryPath], isCheckpoint: "0" })
    );
    const previousById = new Map(
      (await metaInstance.findDocumentsById(metaIds, true)).map((meta) => [meta.itemId, meta])
    );
    const rows: BulkWriteRow<RxStorageReplicationMeta<any, unknown>>[] = states.map((state, index) => {
      const previous = previousById.get(state[primaryPath]);
      const document: RxDocumentData<RxStorageReplicationMeta<any, unknown>> = previous
        ? flatCloneDocWithMeta(previous)
        : {
            id: metaIds[index],
            isCheckpoint: "0",
            itemId: state[primaryPath],
            docData: state,
            _attachments: {},
            _deleted: false,
            _rev: getDefaultRevision(),
            _meta: { lwt: 0 },
          };
      document.docData = state;
      document._meta.lwt = now();
      document._rev = createRevision(db.token, previous);
      return { previous, document };
    });
    const result = await metaInstance.bulkWrite(rows, "sync-take-back-meta");
    if (result.error.length > 0) throw new Error(`take back: could not write ${result.error.length} replication state(s)`);
  } finally {
    await metaInstance.close();
  }
}
