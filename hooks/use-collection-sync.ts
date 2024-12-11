"use client";

import { useState, useEffect } from 'react';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncStatus } from '@/lib/rxdb/sync/types';
import { useSyncHandler } from './use-sync-handler';
import { RxCollection } from 'rxdb';

interface UseCollectionSyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
}

export function useCollectionSync(
  name: CollectionName,
  collection: RxCollection,
  options: UseCollectionSyncOptions = {}
) {
  const { autoSync = true, syncInterval } = options;
  const [state, controls] = useSyncHandler();
  const [status, setStatus] = useState<SyncStatus>({
    collection: name,
    status: 'idle',
  });

  useEffect(() => {
    // Add collection to sync handler
    controls.addCollection(name, collection, {
      enabled: autoSync,
      syncInterval,
    });

    // Update local status when collection status changes
    const newStatus = state.collections.get(name);
    if (newStatus) {
      setStatus(newStatus);
    }

    return () => {
      controls.removeCollection(name);
    };
  }, [name, collection, autoSync, syncInterval]);

  return {
    status,
    startSync: () => controls.startSync([name]),
    stopSync: () => controls.stopSync([name]),
    resetSync: () => controls.resetSync(),
    error: state.error,
    lastSyncTime: state.lastSyncTime,
  };
}