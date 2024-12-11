"use client";

import { createContext, useContext, useEffect } from 'react';
import { SyncContext } from '@/lib/rxdb/sync/sync-context';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncEvent } from '@/lib/rxdb/sync/types';

interface SyncContextValue {
  context: SyncContext;
}

const SyncContextReact = createContext<SyncContextValue | undefined>(undefined);

export function SyncContextProvider({
  children,
  onEvent?: (event: SyncEvent) => void,
}: {
  children: React.ReactNode;
  onEvent?: (event: SyncEvent) => void;
}) {
  const context = SyncContext.getInstance();

  useEffect(() => {
    if (onEvent) {
      const subscription = context.onEvent().subscribe(onEvent);
      return () => subscription.unsubscribe();
    }
  }, [context, onEvent]);

  return (
    <SyncContextReact.Provider value={{ context }}>
      {children}
    </SyncContextReact.Provider>
  );
}

export function useSyncContextReact() {
  const context = useContext(SyncContextReact);
  if (!context) {
    throw new Error('useSyncContextReact must be used within a SyncContextProvider');
  }
  return context;
}