"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";
import type { MatchCollectionName } from "@/lib/rxdb/sync/types";

/** Changes of this match not uploaded yet (pending only). */
export function useMatchUnsentCount(matchId: string): number {
  const { localDb } = useLocalDb();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending) return;
    const subscription = pending.count$({ matchId, statuses: ["pending"] }).subscribe(setCount);
    return () => subscription.unsubscribe();
  }, [localDb, matchId]);
  return count;
}

/** Unsent (pending or rejected) changes in these tables, all matches; null until the first count is known. */
export function useUnsentCountFor(tables: readonly MatchCollectionName[]): number | null {
  const { localDb } = useLocalDb();
  const [count, setCount] = useState<number | null>(null);
  const key = tables.join(",");
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending) return;
    const subscription = pending
      .count$({ tables: key.split(",") as MatchCollectionName[], statuses: ["pending", "rejected"] })
      .subscribe(setCount);
    return () => subscription.unsubscribe();
  }, [localDb, key]);
  return count;
}

/** Asks the browser to confirm before the tab is closed or reloaded. */
export function useBeforeUnloadWhenUnsent(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
