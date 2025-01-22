"use client";

import { useEffect, useState } from "react";
import { getDatabase, type VolleyballDatabase } from "@/lib/rxdb/database";
import { SyncManager } from "@/lib/rxdb/sync/sync-manager";

export function useLocalDatabase() {
  const [localDb, setLocalDb] = useState<VolleyballDatabase | null>(null);
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initDb = async () => {
      try {
        const database = await getDatabase();
        setLocalDb(database);

        const syncManager = SyncManager.getInstance();
        setSyncManager(syncManager);

        return () => {
          syncManager.cleanup();
        };
      } catch (err) {
        console.log(err);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to initialize database"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    initDb();
  }, []);

  return { localDb, syncManager, isLoading, error };
}
