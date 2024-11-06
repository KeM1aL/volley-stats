"use client";

import { createContext, useContext, useEffect } from 'react';
import { useDatabase } from '@/hooks/use-database';
import { SyncHandler } from '@/lib/rxdb/sync/sync-handler';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { SyncIndicator } from '@/components/sync-indicator';
import { CollectionName } from '@/lib/rxdb/schema';
import { RxCollection } from 'rxdb';
import { syncData } from '@/lib/rxdb/sync/sync';

const DatabaseContext = createContext<ReturnType<typeof useDatabase> | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const database = useDatabase();
  const { user } = useAuth();

  useEffect(() => {
    if (database.db && user) {
      // syncData().catch(console.error);

      const syncHandler = new SyncHandler();
      const collections = new Map<CollectionName, RxCollection>([
        ['teams', database.db.teams],
        ['players', database.db.players],
        ['matches', database.db.matches],
        ['sets', database.db.sets],
        ['substitutions', database.db.substitutions],
        ['score_points', database.db.score_points],
        ['player_stats', database.db.player_stats],
      ]);

      syncHandler.initializeSync(collections);

      return () => {
        syncHandler.cleanup();
      };
    }
  }, [database.db, user]);

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
        <p className="text-destructive">Failed to initialize database</p>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
      {/* <SyncIndicator /> */}
    </DatabaseContext.Provider>
  );
}

export function useDb() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDb must be used within a DatabaseProvider');
  }
  return context;
}