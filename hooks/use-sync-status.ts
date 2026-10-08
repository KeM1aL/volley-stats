"use client";

import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useAuth } from "@/contexts/auth-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { writeUnsentHint } from "@/lib/rxdb/pending-hint";
import { deriveSyncStatus, type SyncStatus } from "@/lib/rxdb/sync/status";

/** Live sync status of this device (null until the local database is ready). */
export function useSyncStatus(): SyncStatus | null {
  const { localDb } = useLocalDb();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    const manager = localDb?.syncManager;
    if (!manager) return;
    const subscription = combineLatest([manager.pendingChanges.all$(), manager.tracked.get$()]).subscribe(
      ([entries, tracked]) => {
        const next = deriveSyncStatus({ entries, tracked, userId, online: isOnline });
        writeUnsentHint(next.pendingCount + next.rejectedCount + next.otherAccountCount);
        setStatus(next);
      }
    );
    return () => subscription.unsubscribe();
  }, [localDb, userId, isOnline]);

  // A status from a previous database must not outlive it.
  return localDb?.syncManager ? status : null;
}
