"use client";

import { createContext, useContext, useEffect } from 'react';
import { useLocalDatabase } from '@/hooks/use-local-database';
import { SyncHandler } from '@/lib/rxdb/sync/sync-handler';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from "next/navigation";
import { Loader2 } from 'lucide-react';
import { SyncIndicator } from '@/components/sync-indicator';
import { CollectionName } from '@/lib/rxdb/schema';
import { RxCollection } from 'rxdb';
import { Button } from '../ui/button';

const LocalDatabaseContext = createContext<ReturnType<typeof useLocalDatabase> | null>(null);
const inDevEnvironment = !!process && process.env.NODE_ENV === 'development';

export function LocalDatabaseProvider({ children }: { children: React.ReactNode }) {
  const database = useLocalDatabase();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (database.localDb && user) {
      console.log('Initializing sync...', user)
      // syncData().catch(console.error);

      const syncHandler = new SyncHandler();
      const collections = new Map<CollectionName, RxCollection>([
        ['teams', database.localDb.teams],
        ['team_members', database.localDb.team_members],
        ['matches', database.localDb.matches],
        ['sets', database.localDb.sets],
        ['substitutions', database.localDb.substitutions],
        ['events', database.localDb.events],
        ['score_points', database.localDb.score_points],
        ['player_stats', database.localDb.player_stats],
      ]);

      syncHandler.initializeSync(collections);

      return () => {
        syncHandler.cleanup();
      };
    }
  }, [database.localDb, user]);

  const clearLocalDatabase = () => {
    const params = new URLSearchParams();
    params.set("remove-database", 'true');

    router.push(`/?${params.toString()}`);
  };

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
        {inDevEnvironment && <pre>{JSON.stringify(database.error, null, 2)}</pre>}
        <Button onClick={clearLocalDatabase}>Clear Local Database</Button>
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