import { toTypedRxJsonSchema, type RxCollection, type RxDatabase } from "rxdb";
import { filter, firstValueFrom, map, of, timeout, type Observable } from "rxjs";
import type { ClassifiedError } from "./errors";
import { isoToMicros } from "./timestamps";
import { MATCH_COLLECTIONS, type MatchCollectionName } from "./types";

export type PendingStatus = "pending" | "rejected" | "superseded";

/** One row changed on this device that the server doesn't have yet (or refused). */
export interface PendingChange {
  id: string;
  table_name: MatchCollectionName;
  doc_id: string;
  match_id: string;
  status: PendingStatus;
  attempts: number;
  error_code: string | null;
  error_params: Record<string, string> | null;
  /** The server never accepted this row, so a retry must insert it. */
  never_uploaded: boolean;
  /** Created on this device and not uploaded yet: rows that reference it must wait. */
  is_insert: boolean;
  /** `updated_at` of the row version that was marked. */
  doc_updated_at: string;
  created_at: string;
  updated_at: string;
}

export const pendingChangeSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    table_name: { type: "string", maxLength: 20 },
    doc_id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    status: { type: "string", enum: ["pending", "rejected", "superseded"], maxLength: 10 },
    attempts: { type: "number", minimum: 0, maximum: 1000000, multipleOf: 1 },
    error_code: { type: ["string", "null"] },
    error_params: { type: ["object", "null"] },
    never_uploaded: { type: "boolean" },
    is_insert: { type: "boolean" },
    doc_updated_at: { type: "string", maxLength: 40 },
    created_at: { type: "string", maxLength: 40 },
    updated_at: { type: "string", maxLength: 40 },
  },
  required: [
    "id",
    "table_name",
    "doc_id",
    "match_id",
    "status",
    "attempts",
    "never_uploaded",
    "is_insert",
    "doc_updated_at",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "status"],
});

export type PendingDoc = { id: string; match_id?: string | null; updated_at?: string };

export interface PendingFilter {
  matchId?: string;
  tables?: readonly MatchCollectionName[];
  statuses?: readonly PendingStatus[];
}

export interface ParentRef {
  table: MatchCollectionName;
  docId: string;
}

export type ParentStatus =
  | { kind: "none" }
  | { kind: "pending"; refs: ParentRef[] }
  | { kind: "rejected" | "superseded"; ref: ParentRef };

/** A pending entry this old whose version never reached the local row comes from a write that failed. */
export const SETTLE_GRACE_MS = 30_000;

export const pendingId = (table: MatchCollectionName, docId: string): string => `${table}:${docId}`;

export const matchIdOf = (table: MatchCollectionName, doc: PendingDoc): string =>
  table === "matches" ? doc.id : String(doc.match_id);

function toSelector({ matchId, tables, statuses }: PendingFilter): Record<string, unknown> {
  const selector: Record<string, unknown> = {};
  if (matchId) selector.match_id = matchId;
  if (tables) selector.table_name = { $in: [...tables] };
  if (statuses) selector.status = { $in: [...statuses] };
  return selector;
}

export class PendingChanges {
  constructor(
    readonly collection: RxCollection<PendingChange>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  /** Called by the collection hooks before a row is written on this device. */
  async markPending(table: MatchCollectionName, doc: PendingDoc, opts: { insert: boolean } = { insert: false }): Promise<void> {
    const existing = await this.get(table, doc.id);
    if (existing?.status === "superseded") return;
    await this.write(table, doc, {
      status: "pending",
      attempts: 0,
      error_code: null,
      error_params: null,
      // Still an insert until it uploads, even if it is edited or removed meanwhile.
      is_insert: opts.insert || existing?.is_insert === true || existing?.never_uploaded === true,
      doc_updated_at: doc.updated_at ?? this.now(),
    });
  }

  /** A replication reported the row as uploaded. */
  async onSent(table: MatchCollectionName, doc: PendingDoc): Promise<void> {
    const entry = await this.collection.findOne(pendingId(table, doc.id)).exec();
    if (!entry || entry.status !== "pending") return;
    if ((isoToMicros(doc.updated_at) ?? 0) >= (isoToMicros(entry.doc_updated_at) ?? 0)) await entry.remove();
  }

  async reject(
    table: MatchCollectionName,
    doc: PendingDoc,
    error: ClassifiedError,
    opts: { neverUploaded: boolean }
  ): Promise<void> {
    await this.write(table, doc, {
      status: "rejected",
      error_code: error.code,
      error_params: error.params ?? null,
      never_uploaded: opts.neverUploaded,
    });
  }

  async supersede(table: MatchCollectionName, doc: PendingDoc): Promise<void> {
    await this.write(table, doc, { status: "superseded", error_code: "scorer_mismatch", error_params: null });
  }

  /** Another device took over the match: nothing unsent from this device will upload. */
  async supersedeMatch(matchId: string): Promise<void> {
    const docs = await this.collection
      .find({ selector: { match_id: matchId, status: { $in: ["pending", "rejected"] } } })
      .exec();
    await Promise.all(
      docs.map((doc) =>
        doc.incrementalPatch({ status: "superseded", error_code: "scorer_mismatch", error_params: null, updated_at: this.now() })
      )
    );
  }

  /** Counts a failure that connectivity can't explain; returns the attempts so far. */
  async recordAttempt(table: MatchCollectionName, doc: PendingDoc): Promise<number> {
    const existing = await this.get(table, doc.id);
    if (existing?.status === "superseded") return existing.attempts;
    const attempts = (existing?.attempts ?? 0) + 1;
    await this.write(table, doc, { status: existing?.status === "rejected" ? "rejected" : "pending", attempts });
    return attempts;
  }

  async isNeverUploaded(table: MatchCollectionName, docId: string): Promise<boolean> {
    return (await this.get(table, docId))?.never_uploaded === true;
  }

  async get(table: MatchCollectionName, docId: string): Promise<PendingChange | null> {
    const doc = await this.collection.findOne(pendingId(table, docId)).exec();
    return doc ? (doc.toJSON() as PendingChange) : null;
  }

  /**
   * Whether these parents block a child row. Only rows the server doesn't have
   * yet block: an unsent insert, or a rejected insert. A pending update of an
   * uploaded parent doesn't.
   */
  async parentStatus(refs: ParentRef[]): Promise<ParentStatus> {
    if (refs.length === 0) return { kind: "none" };
    const found = await this.collection.findByIds(refs.map((ref) => pendingId(ref.table, ref.docId))).exec();
    const entries = [...found.values()].map((doc) => doc.toJSON() as PendingChange);
    const toRef = (entry: PendingChange): ParentRef => ({ table: entry.table_name, docId: entry.doc_id });
    const superseded = entries.find((entry) => entry.status === "superseded");
    if (superseded) return { kind: "superseded", ref: toRef(superseded) };
    const rejected = entries.find((entry) => entry.status === "rejected" && (entry.is_insert || entry.never_uploaded));
    if (rejected) return { kind: "rejected", ref: toRef(rejected) };
    const inserts = entries.filter((entry) => entry.status === "pending" && entry.is_insert);
    return inserts.length > 0 ? { kind: "pending", refs: inserts.map(toRef) } : { kind: "none" };
  }

  /** Resolves true once none of these entries is pending, false after `timeoutMs`. */
  waitUntilSettled(refs: ParentRef[], timeoutMs: number): Promise<boolean> {
    const ids = refs.map((ref) => pendingId(ref.table, ref.docId));
    return firstValueFrom(
      this.collection.find({ selector: { id: { $in: ids }, status: "pending" } }).$.pipe(
        filter((docs) => docs.length === 0),
        map(() => true),
        timeout({ first: timeoutMs, with: () => of(false) })
      )
    );
  }

  /**
   * Called once the table's replication for the match is idle and in sync: removes the `pending`
   * entries marked before `before` whose version is settled. That is when the local row (live or
   * removed) has the marked version, so the replication has pushed it, or a later one written by
   * the replication (the server's version won a conflict); or when the entry is older than
   * SETTLE_GRACE_MS (its write failed after the hook marked it). An entry whose write hasn't landed
   * yet (the hook runs before the write) is kept.
   */
  async clearSettled(db: RxDatabase<any>, matchId: string, table: MatchCollectionName, before: string): Promise<void> {
    const entries = await this.collection
      .find({ selector: { match_id: matchId, table_name: table, status: "pending", updated_at: { $lt: before } } })
      .exec();
    if (entries.length === 0) return;
    const collection = db.collections[table] as RxCollection<any>;
    const primaryPath = collection.schema.primaryPath as string;
    const local = new Map(
      (await collection.storageInstance.findDocumentsById(entries.map((entry) => entry.doc_id), true)).map((doc) => [
        doc[primaryPath] as string,
        doc,
      ])
    );
    const failedBefore = Date.parse(this.now()) - SETTLE_GRACE_MS;
    const settled = entries.filter((entry) => {
      if (Date.parse(entry.updated_at) < failedBefore) return true;
      const doc = local.get(entry.doc_id);
      if (!doc) return false;
      const written = isoToMicros(doc.updated_at) ?? 0;
      const marked = isoToMicros(entry.doc_updated_at) ?? 0;
      return written === marked || (written > marked && !doc._deleted);
    });
    // An entry marked again meanwhile no longer matches its read revision: bulkRemove leaves it.
    if (settled.length > 0) await this.collection.bulkRemove(settled);
  }

  async list(filter: PendingFilter = {}): Promise<PendingChange[]> {
    const docs = await this.collection.find({ selector: toSelector(filter) }).exec();
    return docs.map((doc) => doc.toJSON() as PendingChange);
  }

  /** Deletes entries by id (taking scoring back discards the superseded ones). */
  async removeEntries(ids: string[]): Promise<void> {
    if (ids.length > 0) await this.collection.bulkRemove(ids);
  }

  count(filter: PendingFilter = {}): Promise<number> {
    return this.collection.count({ selector: toSelector(filter) }).exec();
  }

  count$(filter: PendingFilter = {}): Observable<number> {
    return this.collection.count({ selector: toSelector(filter) }).$;
  }

  all$(): Observable<PendingChange[]> {
    return this.collection.find().$.pipe(map((docs) => docs.map((doc) => doc.toJSON() as PendingChange)));
  }

  /**
   * Re-queues rejected rows: bumping updated_at runs the hooks, which mark them pending.
   * Parents go first: a child queued while its rejected parent still waits would be
   * rejected again at once as `parent_rejected`. A rejected removal is written again as a
   * new revision of the deleted row. An entry whose row is gone from this device stays rejected.
   */
  async retryRejected(db: RxDatabase<any>, matchId?: string): Promise<number> {
    const entries = (await this.collection.find({ selector: toSelector({ matchId, statuses: ["rejected"] }) }).exec()).sort(
      (a, b) => MATCH_COLLECTIONS.indexOf(a.table_name) - MATCH_COLLECTIONS.indexOf(b.table_name)
    );
    let retried = 0;
    for (const entry of entries) {
      const collection = db.collections[entry.table_name];
      const doc = await collection.findOne(entry.doc_id).exec();
      if (doc) {
        await doc.incrementalPatch({ updated_at: this.now() });
        retried += 1;
      } else if (await this.retryRemoval(collection, entry.toJSON() as PendingChange)) {
        retried += 1;
      }
    }
    return retried;
  }

  /**
   * Writes a new revision of a row removed on this device, so the replication pushes the
   * removal again. RxDB documents can't be edited once deleted, so this goes through the
   * storage instance (which sets `_rev` and `_meta`, as `bulkRemove` does) and bypasses the
   * hooks: the entry is marked pending here.
   */
  private async retryRemoval(collection: RxCollection<any>, entry: PendingChange): Promise<boolean> {
    const [previous] = await collection.storageInstance.findDocumentsById([entry.doc_id], true);
    if (!previous?._deleted) return false;
    const document = { ...previous, updated_at: this.now() };
    await this.markPending(entry.table_name, document);
    const result = await collection.storageInstance.bulkWrite([{ previous, document }], "sync-retry-removal");
    if (result.error.length === 0) return true;
    // Written meanwhile: put the entry back as it was, so the user can retry again.
    const { status, error_code, error_params, attempts, doc_updated_at } = entry;
    await this.write(entry.table_name, document, { status, error_code, error_params, attempts, doc_updated_at });
    return false;
  }

  private async write(table: MatchCollectionName, doc: PendingDoc, patch: Partial<PendingChange>): Promise<void> {
    const id = pendingId(table, doc.id);
    const now = this.now();
    // A superseded entry stays superseded: a push that was in flight when the match was lost
    // must not turn it back into pending or rejected (its replication is stopped, nothing would clear it).
    const apply = (data: PendingChange): PendingChange =>
      data.status === "superseded" && patch.status !== "superseded" ? data : { ...data, ...patch, updated_at: now };
    const existing = await this.collection.findOne(id).exec();
    if (existing) {
      await existing.incrementalModify(apply);
      return;
    }
    const entry: PendingChange = {
      id,
      table_name: table,
      doc_id: doc.id,
      match_id: matchIdOf(table, doc),
      status: "pending",
      attempts: 0,
      error_code: null,
      error_params: null,
      never_uploaded: false,
      is_insert: false,
      doc_updated_at: doc.updated_at ?? now,
      created_at: now,
      updated_at: now,
      ...patch,
    };
    try {
      await this.collection.insert(entry);
    } catch (error) {
      // Written concurrently by another hook call: patch that entry instead.
      const again = await this.collection.findOne(id).exec();
      if (!again) throw error;
      await again.incrementalModify(apply);
    }
  }
}

/** Marks every local write of match data as pending. Replication writes bypass hooks. */
export function installPendingHooks(db: RxDatabase<any>, pending: PendingChanges): void {
  for (const table of MATCH_COLLECTIONS) {
    const collection = db.collections[table];
    collection.preInsert((data: PendingDoc) => pending.markPending(table, data, { insert: true }), false);
    collection.preSave((data: PendingDoc) => pending.markPending(table, data), false);
    collection.preRemove((data: PendingDoc) => pending.markPending(table, data), false);
  }
}
