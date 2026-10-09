"use client";

import { useContext } from "react";
import { SyncStatusContext } from "@/components/providers/sync-status-provider";
import type { SyncStatus } from "@/lib/rxdb/sync/status";

/**
 * Live sync status of this device: null until the local database is ready. Read from
 * `SyncStatusProvider`, which computes it once for all the components that show it.
 */
export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncStatusContext);
}
