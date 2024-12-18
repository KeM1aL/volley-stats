"use client";

import { createContext, useContext, useEffect } from 'react';
import { useLocalDatabase } from '@/hooks/use-local-database';
import { SyncHandler } from '@/lib/rxdb/sync/sync-handler';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { SyncIndicator } from '@/components/sync-indicator';
import { CollectionName } from '@/lib/rxdb/schema';
import { RxCollection } from 'rxdb';
import { SyncManager } from '@/lib/rxdb/sync/sync-manager';

const LocalDatabaseContext = createContext<ReturnType<typeof useLocalDatabase> | null>(null);

export function LocalDatabaseProvider({ children }: { children: React.ReactNode }) {
  const database = useLocalDatabase();
  const { user } = useAuth();

  useEffect(() => {
    if (database.localDb && user) {

      // We can add here initial loading data for the database
    }
  }, [database.localDb, user]);

  if (database.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (database.error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">Failed to initialize local database</p>
        <pre>{JSON.stringify(database.error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <LocalDatabaseContext.Provider value={database}>
      {children}
      {/* <SyncIndicator /> */}
    </LocalDatabaseContext.Provider>
  );
}

export function useLocalDb() {
  const context = useContext(LocalDatabaseContext);
  if (!context) {
    throw new Error('useLocalDb must be used within a DatabaseProvider');
  }
  return context;
}