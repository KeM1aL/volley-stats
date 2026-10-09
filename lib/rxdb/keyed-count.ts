/**
 * A count tied to the inputs it was computed for (a match, a set of tables): once the inputs
 * change the old count is not the answer any more.
 */
export type KeyedCount = { key: string; count: number };

/** The count if it belongs to `key`, else `initial` (until the new subscription reports). */
export function countFor<T extends number | null>(state: KeyedCount | null, key: string, initial: T): number | T {
  return state?.key === key ? state.count : initial;
}
