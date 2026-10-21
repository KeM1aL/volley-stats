"use client";

import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { countFor, type KeyedCount } from "@/lib/rxdb/keyed-count";
import type { PendingStatus } from "@/lib/rxdb/sync/pending-changes";
import type { MatchCollectionName } from "@/lib/rxdb/sync/types";

/** Changes of this match in these statuses (default: pending only, i.e. not uploaded yet). */
export function useMatchUnsentCount(matchId: string, statuses: readonly PendingStatus[] = ["pending"]): number {
  const { localDb } = useLocalDb();
  const [state, setState] = useState<KeyedCount | null>(null);
  const statusKey = statuses.join(",");
  const key = `${matchId}:${statusKey}`;
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending) return;
    const subscription = pending
      .count$({ matchId, statuses: statusKey.split(",") as PendingStatus[] })
      .subscribe((count) => setState({ key, count }));
    return () => subscription.unsubscribe();
  }, [localDb, matchId, statusKey, key]);
  return countFor(state, key, 0);
}

/**
 * Unsent (pending or rejected) changes in these tables, all matches; null until the first count is known.
 * No tables: nothing can be unsent, 0 without querying.
 */
export function useUnsentCountFor(tables: readonly MatchCollectionName[]): number | null {
  const { localDb } = useLocalDb();
  const [state, setState] = useState<KeyedCount | null>(null);
  const key = tables.join(",");
  const none = tables.length === 0;
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending || none) return;
    const subscription = pending
      .count$({ tables: key.split(",") as MatchCollectionName[], statuses: ["pending", "rejected"] })
      .subscribe((count) => setState({ key, count }));
    return () => subscription.unsubscribe();
  }, [localDb, key, none]);
  return none ? 0 : countFor(state, key, null);
}

export interface UnsentBreakdown {
  /** Still waiting to upload. */
  pending: number;
  /** Refused by the server: they will never upload (SyncManager.discardRejected drops them). */
  rejected: number;
}

/**
 * Unsent changes in these tables, all matches, split into pending and rejected; null until both
 * counts are known. No tables: nothing can be unsent, zeros without querying.
 */
export function useUnsentBreakdownFor(tables: readonly MatchCollectionName[]): UnsentBreakdown | null {
  const { localDb } = useLocalDb();
  const [state, setState] = useState<{ key: string; value: UnsentBreakdown } | null>(null);
  const key = tables.join(",");
  const none = tables.length === 0;
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending || none) return;
    const keyTables = key.split(",") as MatchCollectionName[];
    const subscription = combineLatest([
      pending.count$({ tables: keyTables, statuses: ["pending"] }),
      pending.count$({ tables: keyTables, statuses: ["rejected"] }),
    ]).subscribe(([pendingCount, rejectedCount]) => setState({ key, value: { pending: pendingCount, rejected: rejectedCount } }));
    return () => subscription.unsubscribe();
  }, [localDb, key, none]);
  if (none) return { pending: 0, rejected: 0 };
  return state?.key === key ? state.value : null;
}

// Set right before an in-app navigation the user already confirmed (our own dialog), so the browser's
// "Changes you made may not be saved" doesn't follow it. Offline, the router falls back to a full page load.
let unloadAllowed = false;
let unloadAllowedTimer: ReturnType<typeof setTimeout> | undefined;

function clearUnloadAllowed() {
  unloadAllowed = false;
  clearTimeout(unloadAllowedTimer);
}

/**
 * Lets the next unload of this page through without the browser's prompt. A navigation that never
 * happens must not disable the guard for good: the flag resets on `pageshow` and after 5 seconds.
 */
export function allowNextUnload(): void {
  unloadAllowed = true;
  clearTimeout(unloadAllowedTimer);
  unloadAllowedTimer = setTimeout(clearUnloadAllowed, 5000);
  window.addEventListener("pageshow", clearUnloadAllowed, { once: true });
}

/** Asks the browser to confirm before the tab is closed or reloaded. */
export function useBeforeUnloadWhenUnsent(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (unloadAllowed) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
