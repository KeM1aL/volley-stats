"use client";

import { createContext, useContext, useEffect } from 'react';
import { useDatabase } from '@/hooks/use-database';
import { syncData } from '@/lib/rxdb/sync';
import { Loader2 } from 'lucide-react';

const DatabaseContext = createContext<ReturnType<typeof useDatabase> | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const database = useDatabase();

  useEffect(() => {
    if (database.db) {
      syncData().catch(console.error);
    }
  }, [database.db]);

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