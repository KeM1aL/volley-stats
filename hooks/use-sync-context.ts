"use client";

import { useEffect, useState } from 'react';
import { SyncContext } from '@/lib/rxdb/sync/sync-context';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncStatus } from '@/lib/rxdb/sync/types';

export function useSyncContext(collection: CollectionName) {
  const context = SyncContext.getInstance();
  const [status, setStatus] = useState<SyncStatus | undefined>(
    context.getStatus(collection)
  );

  useEffect(() => {
    const subscription = context.onCollectionEvent(collection).subscribe(event => {
      if (event.type === 'sync-status-updated') {
        setStatus(event.data.status);
      }
    });

    return () => subscription.unsubscribe();
  }, [collection]);

  const acquireLock = async (timeout?: number) => {
    return await context.acquireLock(collection, timeout);
  };

  const releaseLock = (lockId: string) => {
    return context.releaseLock(lockId);
  };

  const withLock = async <T,>(
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> => {
    return await context.withLock(collection, operation, timeout);
  };

  return {
    status,
    acquireLock,
    releaseLock,
    withLock,
  };
}