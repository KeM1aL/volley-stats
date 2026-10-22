import type { SyncBadgeState } from "./status";

/** What the "All saved" toast remembers between two sync states. */
export interface AllSavedTracker {
  previous: SyncBadgeState | null;
  /** The queue was waiting (offline) since the last toast. */
  sawWaiting: boolean;
}

export const INITIAL_ALL_SAVED_TRACKER: AllSavedTracker = { previous: null, sawWaiting: false };

/**
 * Feeds the next sync state; `toast` is true once when the queue empties after a wait for a connection
 * (a move to "saved" from any other state, after "waiting" was seen). A null state (status not computed yet) changes nothing.
 */
export function trackAllSaved(tracker: AllSavedTracker, state: SyncBadgeState | null): { tracker: AllSavedTracker; toast: boolean } {
  if (!state) return { tracker, toast: false };
  const sawWaiting = tracker.sawWaiting || state === "waiting";
  const emptied = state === "saved" && tracker.previous !== null && tracker.previous !== "saved";
  const toast = emptied && sawWaiting;
  return { tracker: { previous: state, sawWaiting: toast ? false : sawWaiting }, toast };
}
