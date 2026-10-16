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
import type { PendingChange, PendingChanges, PendingStatus } from "./pending-changes";
import { MATCH_COLLECTIONS, type MatchCollectionName } from "./types";

/** Ids per request when fetching the server's version of the rows (keeps the URL short). */
const FETCH_CHUNK = 100;

export interface DiscardChangesOptions {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  pending: PendingChanges;
  deviceId: string;
  matchId: string;
  /** Checked before each table and before writing what was read: true stops the discard there (tables done stay done). */
  shouldStop?: () => boolean;
}

type DiscardStatus = Exclude<PendingStatus, "pending">;

/** What discarding a match's changes of one status will write: the server's version of each row, read beforehand. */
export interface DiscardPlan {
  matchId: string;
  status: DiscardStatus;
  tables: TablePlan[];
}

interface TablePlan {
  table: MatchCollectionName;
  /** The entries listed when the plan was made, and their rows. */
  entryIds: string[];
  docIds: string[];
  serverDocs: Map<string, WithDeleted<any>>;
}

/**
 * Taking scoring back (controller ruling for N1): this device's superseded changes to the match
 * (rows it recorded but never uploaded before another device took over) are discarded, so that the
 * device shows the match as the server has it. Table by table: read the server, then write
 * (see applyTablePlan). Throws if the server can't be read; tables done before stay done.
 */
export async function discardSupersededChanges({
  db,
  client,
  pending,
  deviceId,
  matchId,
  shouldStop,
}: DiscardChangesOptions): Promise<number> {
  const entries = await pending.list({ matchId, statuses: ["superseded"] });
  let discarded = 0;
  for (const table of MATCH_COLLECTIONS) {
    if (shouldStop?.()) return discarded;
    const tablePlan = await planTable(db, client, deviceId, table, entries);
    if (!tablePlan) continue;
    if (shouldStop?.()) return discarded;
    discarded += await applyTablePlan(db, pending, matchId, "superseded", tablePlan);
  }
  return discarded;
}

/**
 * The server refused these changes (rejected: RLS, invalid data, ...), so they will never upload.
 * First half of discarding them: reads the server's version of each refused row of the match.
 * Changes nothing locally; throws if the server can't be read or `signal` aborts.
 */
export async function planRejectedDiscard(
  { db, client, pending, deviceId, matchId }: Omit<DiscardChangesOptions, "shouldStop">,
  signal?: AbortSignal
): Promise<DiscardPlan> {
  const entries = await pending.list({ matchId, statuses: ["rejected"] });
  const tables: TablePlan[] = [];
  for (const table of MATCH_COLLECTIONS) {
    const tablePlan = await planTable(db, client, deviceId, table, entries, signal);
    if (tablePlan) tables.push(tablePlan);
  }
  return { matchId, status: "rejected", tables };
}

/**
 * Second half, local only: writes the planned server versions and deletes the entries, as a
 * take-back does. An entry that changed since it was listed (its row was edited, so it is pending
 * again) or is gone keeps its row as it is. Returns how many entries were deleted.
 */
export async function applyDiscardPlan(db: LocalDatabase, pending: PendingChanges, plan: DiscardPlan): Promise<number> {
  let discarded = 0;
  for (const tablePlan of plan.tables) discarded += await applyTablePlan(db, pending, plan.matchId, plan.status, tablePlan);
  return discarded;
}

async function planTable(
  db: LocalDatabase,
  client: SupabaseClient<any>,
  deviceId: string,
  table: MatchCollectionName,
  entries: PendingChange[],
  signal?: AbortSignal
): Promise<TablePlan | null> {
  const tableEntries = entries.filter((entry) => entry.table_name === table);
  if (tableEntries.length === 0) return null;
  const collection = db[table] as unknown as RxCollection<any>;
  const ids = tableEntries.map((entry) => entry.doc_id);
  const serverDocs = await fetchServerDocs(client, collection, table, ids, deviceId, signal);
  return { table, entryIds: tableEntries.map((entry) => entry.id), docIds: ids, serverDocs };
}

/**
 * Each row whose entry still has the status is replaced by the server's version, or removed locally
 * when the server doesn't have it; then those entries are deleted.
 *
 * Nothing of this may reach the server. The rows are written through the storage instance (no
 * hooks, so no pending entry), and the match's replication meta is set to the same state: RxDB's
 * upstream skips a row whose fork state equals its assumed master state, so the restarted
 * replication neither re-inserts a discarded row nor pushes its removal. The replications of the
 * match must be stopped while this runs (a lost claim, or SyncManager.discardRejected stops them).
 *
 * An edit made to a refused row while this runs must survive. The local rows are read first, then
 * the entries' status straight from storage, and only rows whose entry still has the status are
 * written, against the rows read first. The pending hook marks an entry before its row is written,
 * so an edit is either visible as a pending entry here (its row is left alone), or its row write
 * comes after the local read and the aligned write conflicts (409: left as it is). An entry changed
 * after it was read isn't deleted. Rows and entries are separate collections, so this narrows the
 * window rather than making the pair atomic: it relies on the hook's mark-then-write order.
 */
async function applyTablePlan(
  db: LocalDatabase,
  pending: PendingChanges,
  matchId: string,
  status: DiscardStatus,
  { table, entryIds, docIds, serverDocs }: TablePlan
): Promise<number> {
  const collection = db[table] as unknown as RxCollection<any>;
  const primaryPath = collection.schema.primaryPath as string;
  // Rows first, statuses second (see above).
  const local = new Map(
    (await collection.storageInstance.findDocumentsById(docIds, true)).map((doc) => [doc[primaryPath] as string, doc])
  );
  const current = await pending.withStatus(entryIds, status);
  if (current.length === 0) return 0;
  const aligned = await alignRows(
    db,
    collection,
    matchReplicationIdentifier(table, matchId),
    current.map((entry) => entry.doc_id),
    serverDocs,
    local
  );
  const removed = await pending.removeUnchanged(current.filter((entry) => aligned.has(entry.doc_id)));
  return removed.size;
}

async function fetchServerDocs(
  client: SupabaseClient<any>,
  collection: RxCollection<any>,
  table: MatchCollectionName,
  ids: string[],
  deviceId: string,
  signal?: AbortSignal
): Promise<Map<string, WithDeleted<any>>> {
  const properties = collection.schema.jsonSchema.properties as Record<string, unknown>;
  const docs = new Map<string, WithDeleted<any>>();
  for (let start = 0; start < ids.length; start += FETCH_CHUNK) {
    signal?.throwIfAborted();
    const chunk = ids.slice(start, start + FETCH_CHUNK);
    let query = client.from(table).select("*").in("id", chunk).setHeader("x-device-id", deviceId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      // Same shape as a pulled row (replication.ts rowToDoc).
      docs.set(String(row.id), { ...pickSchemaFields(row, properties), _deleted: !!row._deleted } as WithDeleted<any>);
    }
  }
  signal?.throwIfAborted();
  return docs;
}

/** Strips RxDB's bookkeeping fields, as the upstream does before comparing with the assumed master. */
function toDocState(doc: RxDocumentData<any>): WithDeleted<any> {
  const { _meta: _m, _rev: _r, _attachments: _a, ...state } = doc;
  return state as WithDeleted<any>;
}

/**
 * Writes these rows against `local` (the rows as read before). Returns the ids aligned: a row written
 * since it was read (a conflict) is left as it is.
 */
async function alignRows(
  db: LocalDatabase,
  collection: RxCollection<any>,
  replicationIdentifier: string,
  ids: string[],
  serverDocs: Map<string, WithDeleted<any>>,
  local: Map<string, RxDocumentData<any>>
): Promise<Set<string>> {
  const forkWrites: BulkWriteRow<any>[] = [];
  // Every id: its final state, or null when the row is nowhere (nothing to align, its entry can go).
  const finalStates = new Map<string, WithDeleted<any> | null>();
  for (const id of ids) {
    const previous = local.get(id);
    const server = serverDocs.get(id);
    if (server) {
      forkWrites.push({
        previous,
        document: { ...server, _attachments: {}, _meta: { ...(previous?._meta ?? {}), lwt: now() }, _rev: previous?._rev ?? "" },
      });
      finalStates.set(id, server);
    } else if (previous) {
      // Never on the server: removed here only.
      if (!previous._deleted) forkWrites.push({ previous, document: { ...previous, _deleted: true } });
      finalStates.set(id, { ...toDocState(previous), _deleted: true });
    } else {
      finalStates.set(id, null);
    }
  }
  if (forkWrites.length > 0) {
    // The wrapped storage instance sets `_rev` and `_meta.lwt`; the collection sees the change (queries update).
    const result = await collection.storageInstance.bulkWrite(forkWrites, "sync-take-back");
    for (const error of result.error) {
      if (error.status !== 409) throw new Error(`discard: could not write local row ${error.documentId} (status ${error.status})`);
      finalStates.delete(error.documentId);
    }
  }
  const states = [...finalStates.values()].filter((state): state is WithDeleted<any> => state !== null);
  await writeAssumedMasterStates(db, collection, replicationIdentifier, states);
  return new Set(finalStates.keys());
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
    if (result.error.length > 0) throw new Error(`discard: could not write ${result.error.length} replication state(s)`);
  } finally {
    await metaInstance.close();
  }
}
