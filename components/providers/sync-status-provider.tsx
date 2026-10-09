"use client";

import { createContext, useEffect, useState } from "react";
import { combineLatest } from "rxjs";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useAuth } from "@/contexts/auth-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { writeUnsentHint } from "@/lib/rxdb/pending-hint";
import type { SyncManager } from "@/lib/rxdb/sync/manager";
import { deriveSyncStatus, type SyncStatus } from "@/lib/rxdb/sync/status";

export const SyncStatusContext = createContext<SyncStatus | null>(null);

/**
 * Computes the sync status of this device once for the whole tree (the badges and flags read it
 * through `useSyncStatus`) and mirrors the unsent count into the reset guard's hint.
 */
export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const { localDb } = useLocalDb();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [computed, setComputed] = useState<{ manager: SyncManager; status: SyncStatus } | null>(null);
  const userId = user?.id ?? null;
  const manager = localDb?.syncManager ?? null;

  useEffect(() => {
    if (!manager) return;
    const subscription = combineLatest([manager.pendingChanges.all$(), manager.tracked.get$()]).subscribe(
      ([entries, tracked]) => {
        const next = deriveSyncStatus({ entries, tracked, userId, online: isOnline });
        writeUnsentHint(next.pendingCount + next.rejectedCount + next.otherAccountCount);
        setComputed({ manager, status: next });
      }
    );
    return () => subscription.unsubscribe();
  }, [manager, userId, isOnline]);

  // A status computed for another manager (a replaced database) is not shown.
  const status = computed && computed.manager === manager ? computed.status : null;
  return <SyncStatusContext.Provider value={status}>{children}</SyncStatusContext.Provider>;
}
