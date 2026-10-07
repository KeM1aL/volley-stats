import type { RxConflictHandler } from "rxdb";
import { isoToMicros } from "./timestamps";

const IGNORED_FIELDS = new Set(["_meta", "_rev", "_attachments", "_modified"]);

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const micros = isoToMicros(value);
  if (micros !== null) return `ts:${micros}`;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (IGNORED_FIELDS.has(key)) continue;
      const normalized = normalize((value as Record<string, unknown>)[key]);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
}

/**
 * Field-by-field equality of two row versions: timestamps compared as
 * instants (Postgres returns `+00:00` and microseconds, the device writes `Z`
 * and milliseconds), missing equals null, server-only and RxDB bookkeeping
 * fields ignored.
 */
export function docsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function updatedAtMicros(doc: { updated_at?: unknown }): number {
  return isoToMicros(doc.updated_at) ?? 0;
}

/**
 * One scoring device per match (spec section 3):
 * - the device knew a previous server version → the device's version wins;
 * - no record of the server version (retry after an interrupted push, first
 *   push after the upgrade) → the later `updated_at` wins, ties to the server.
 */
export const matchConflictHandler: RxConflictHandler<any> = {
  isEqual: (a, b) => docsEqual(a, b),
  resolve: async ({ newDocumentState, assumedMasterState, realMasterState }) => {
    if (assumedMasterState) return newDocumentState;
    return updatedAtMicros(newDocumentState) > updatedAtMicros(realMasterState) ? newDocumentState : realMasterState;
  },
};
