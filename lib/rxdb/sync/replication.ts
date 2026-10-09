import {
  addRxPlugin,
  flatClone,
  lastOfArray,
  type ReplicationPullOptions,
  type ReplicationPushOptions,
  type RxReplicationWriteToMasterRow,
  type WithDeleted,
} from "rxdb";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxReplicationState, startReplicationOnLeaderShip } from "rxdb/plugins/replication";
import { docsEqual } from "./conflict-handler";
import { classifyPushError, countsTowardsAttemptLimit, MAX_TEMPORARY_ATTEMPTS, type PostgrestLikeError } from "./errors";
import { addDocEqualityToQuery, pickSchemaFields, POSTGRES_INSERT_CONFLICT_CODE } from "./helper";
import type { SupabaseCheckpoint, SupabaseReplicationOptions } from "./types";

/** Server-only checkpoint column, set by a trigger (spec section 1). */
export const MODIFIED_FIELD = "_modified";
export const DELETED_FIELD = "_deleted";

/** Thrown by the push handler so RxDB retries the batch after `retryTime`. */
export class PushRetryError extends Error {
  constructor(readonly reasons: string[]) {
    super(`push retry: ${reasons.join(", ")}`);
    this.name = "PushRetryError";
  }
}

/** An UPDATE that matched no row although the server row is the assumed one (classified as `rls`, or `auth` on 401). */
const UPDATE_REFUSED: PostgrestLikeError = { code: "42501", message: "update_refused" };

type WriteOutcome =
  | { kind: "ok" }
  | { kind: "conflict"; master: WithDeleted<any> }
  | { kind: "error"; error: PostgrestLikeError; status: number; phase: "insert" | "update" };

type FetchOutcome = { doc: WithDeleted<any> | null } | { error: PostgrestLikeError; status: number };

/**
 * RxDB replication with Supabase, based on rxdb/plugins/replication-supabase
 * 17.6.0. Differences: the `_modified` checkpoint column is server-only,
 * unknown server columns are dropped, rows are pushed one at a time through a
 * gate (parents first, scorer claim) with per-row error classification, and
 * sync requests carry `x-device-id`.
 */
export function replicateSupabase(options: SupabaseReplicationOptions): RxReplicationState<any, SupabaseCheckpoint> {
  addRxPlugin(RxDBLeaderElectionPlugin);
  const { collection, client, tableName, deviceId } = options;
  const primaryPath = collection.schema.primaryPath as string;
  const schemaProperties = collection.schema.jsonSchema.properties as Record<string, unknown>;

  function withDevice<Q>(query: Q): Q {
    return deviceId ? (query as any).setHeader("x-device-id", deviceId) : query;
  }

  function rowToDoc(row: Record<string, unknown>): WithDeleted<any> {
    const doc = pickSchemaFields(row, schemaProperties) as Record<string, unknown>;
    doc._deleted = !!row[DELETED_FIELD];
    return doc as WithDeleted<any>;
  }

  async function fetchById(id: string): Promise<FetchOutcome> {
    const { data, error, status } = await withDevice(client.from(tableName).select("*").eq(primaryPath, id).limit(1));
    if (error) return { error, status };
    return { doc: data && data.length === 1 ? rowToDoc(data[0]) : null };
  }

  async function insert(doc: WithDeleted<any>): Promise<WriteOutcome> {
    const { error, status } = await withDevice(client.from(tableName).insert(doc));
    if (!error) return { kind: "ok" };
    if (error.code !== POSTGRES_INSERT_CONFLICT_CODE) return { kind: "error", error, status, phase: "insert" };
    const found = await fetchById(doc[primaryPath]);
    if ("error" in found) return { kind: "error", error: found.error, status: found.status, phase: "insert" };
    // Duplicate on another unique constraint, or a row this user can't read.
    if (!found.doc) return { kind: "error", error, status, phase: "insert" };
    // An earlier attempt was committed but its response was lost.
    return docsEqual(found.doc, doc) ? { kind: "ok" } : { kind: "conflict", master: found.doc };
  }

  async function update(doc: WithDeleted<any>, assumed: WithDeleted<any>): Promise<WriteOutcome> {
    const id = doc[primaryPath] as string;
    const row: Record<string, unknown> = flatClone(doc);
    delete row[MODIFIED_FIELD];
    const query = addDocEqualityToQuery(
      collection.schema.jsonSchema,
      DELETED_FIELD,
      MODIFIED_FIELD,
      assumed,
      client.from(tableName).update(row)
    );
    const { data, error, status } = await withDevice(query.select());
    if (error) return { kind: "error", error, status, phase: "update" };
    if (data && data.length > 0) return { kind: "ok" };
    // No row matched. A write refused by RLS `USING` (not an owner, or the anon key after a failed
    // refresh) looks the same as a changed row: PostgREST answers `[]`, not an error.
    const refused: WriteOutcome = { kind: "error", error: UPDATE_REFUSED, status, phase: "update" };
    const found = await fetchById(id);
    if ("error" in found) return { kind: "error", error: found.error, status: found.status, phase: "update" };
    if (!found.doc) {
      // Sent without a session: the row may just be hidden from the anon role.
      if (status === 401) return refused;
      // Never accepted by the server (rejected insert being retried): insert it.
      if (await options.push?.reporter?.neverUploaded(id)) return insert(doc);
      // Deleted on the server: never re-create it silently.
      return { kind: "error", error: { code: "row_missing", message: "row_missing" }, status: 404, phase: "update" };
    }
    if (docsEqual(found.doc, doc)) return { kind: "ok" };
    // The server still has the version this device knew, so the equality filter matched it: the write
    // was refused, not overtaken. A conflict here would be resolved and re-pushed in a loop.
    if (docsEqual(found.doc, assumed)) return refused;
    return { kind: "conflict", master: found.doc };
  }

  const pull: ReplicationPullOptions<any, SupabaseCheckpoint> | undefined = options.pull
    ? {
        batchSize: options.pull.batchSize ?? 100,
        async handler(lastCheckpoint, batchSize) {
          let query = client.from(tableName).select("*");
          if (options.pull?.queryBuilder) query = options.pull.queryBuilder(query) ?? query;
          if (lastCheckpoint) {
            const { modified, id } = lastCheckpoint;
            query = query.or(
              `"${MODIFIED_FIELD}".gt.${modified},and("${MODIFIED_FIELD}".eq.${modified},"${primaryPath}".gt.${id})`
            );
          }
          query = query
            .order(MODIFIED_FIELD, { ascending: true })
            .order(primaryPath, { ascending: true })
            .limit(batchSize);
          const { data, error } = await withDevice(query);
          if (error) throw error;
          const rows = (data ?? []) as Record<string, any>[];
          const last = lastOfArray(rows);
          return {
            documents: rows.map(rowToDoc),
            checkpoint: last ? { id: last[primaryPath], modified: last[MODIFIED_FIELD] } : lastCheckpoint,
          };
        },
      }
    : undefined;

  // Rows (by id, with the JSON of the state) that reached a final outcome during a batch that is
  // then retried: accepted, rejected or superseded. They are not sent or reported again.
  // Conflicts are not final (RxDB resolves them), so they are not recorded.
  const settled = new Map<string, string>();

  const push: ReplicationPushOptions<any> | undefined = options.push
    ? {
        batchSize: options.push.batchSize ?? 50,
        modifier: options.push.modifier,
        async handler(rows: RxReplicationWriteToMasterRow<any>[]) {
          const { gate, reporter } = options.push!;
          const conflicts: WithDeleted<any>[] = [];
          const retryReasons: string[] = [];

          for (const row of rows) {
            const doc = row.newDocumentState as WithDeleted<any>;
            const id = doc[primaryPath] as string;
            const docState = JSON.stringify(doc);
            if (settled.get(id) === docState) continue;

            const decision = gate ? await gate.check(doc) : ({ kind: "send" } as const);
            if (decision.kind === "wait") {
              // Rows behind it are retried with the batch; waiting on each in turn would cost PARENT_WAIT_MS per row.
              retryReasons.push(`${id}: waiting for ${decision.reason}`);
              break;
            }
            if (decision.kind === "supersede") {
              await reporter?.superseded(doc);
              settled.set(id, docState);
              continue;
            }
            if (decision.kind === "reject") {
              await reporter?.rejected(doc, decision.error, { neverUploaded: !row.assumedMasterState });
              settled.set(id, docState);
              continue;
            }

            const outcome = row.assumedMasterState
              ? await update(doc, row.assumedMasterState as WithDeleted<any>)
              : await insert(doc);
            if (outcome.kind === "ok") {
              settled.set(id, docState);
              continue;
            }
            if (outcome.kind === "conflict") {
              conflicts.push(outcome.master);
              continue;
            }

            const classified = classifyPushError(outcome.error, outcome.status);
            if (classified.kind === "superseded") {
              await reporter?.superseded(doc);
              settled.set(id, docState);
              continue;
            }
            if (classified.kind === "permanent") {
              await reporter?.rejected(doc, classified, { neverUploaded: outcome.phase === "insert" });
              settled.set(id, docState);
              continue;
            }
            if (reporter && countsTowardsAttemptLimit(classified.code)) {
              const attempts = await reporter.temporaryFailure(doc, classified);
              if (attempts >= MAX_TEMPORARY_ATTEMPTS) {
                await reporter.rejected(
                  doc,
                  { kind: "permanent", code: "too_many_attempts", params: { last: classified.code } },
                  { neverUploaded: outcome.phase === "insert" }
                );
                settled.set(id, docState);
                continue;
              }
            }
            retryReasons.push(`${id}: ${classified.code}`);
            if (classified.code === "network" || classified.code === "auth") break; // the next rows would fail too
          }

          if (retryReasons.length > 0) throw new PushRetryError(retryReasons);
          for (const row of rows) settled.delete((row.newDocumentState as any)[primaryPath]);
          return conflicts;
        },
      }
    : undefined;

  const state = new RxReplicationState<any, SupabaseCheckpoint>(
    options.replicationIdentifier,
    collection,
    DELETED_FIELD,
    pull,
    push,
    options.live ?? true,
    options.retryTime ?? 5000,
    options.autoStart ?? true,
    false // keep replicating in the background tab that holds leadership
  );
  startReplicationOnLeaderShip(options.waitForLeadership ?? true, state);
  return state;
}
