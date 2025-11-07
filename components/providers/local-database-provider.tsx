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
      const syncHandler = new SyncHandler();
      const collections = new Map<CollectionName, RxCollection>([
        ['championships', database.localDb.championships],
        ['seasons', database.localDb.seasons],
        ['match_formats', database.localDb.match_formats],
        ['clubs', database.localDb.clubs],
        ['club_members', database.localDb.club_members],
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
    const errorString = JSON.stringify(database.error, null, 2);
    const isSchemaError = errorString.includes('OpenFailedError') ||
                          errorString.includes('schema') ||
                          errorString.includes('version');

    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 p-8">
        <p className="text-destructive font-semibold">Failed to initialize local database</p>
        {isSchemaError && (
          <div className="text-sm text-muted-foreground max-w-md text-center">
            <p>The database schema has been updated and is incompatible with existing data.</p>
            <p className="mt-2">Click below to clear the local database. Your data will be re-synced from the server on next login.</p>
          </div>
        )}
        {inDevEnvironment && <pre className="text-xs max-w-2xl overflow-auto">{errorString}</pre>}
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