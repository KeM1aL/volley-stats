"use client";

import { useState, useEffect } from 'react';
import { getDatabase, type VolleyballDatabase } from '@/lib/rxdb/database';

export function useLocalDatabase(enabled: boolean = true) {
  const [localDb, setLocalDb] = useState<VolleyballDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
        setIsLoading(false);
        return;
    }

    const initDb = async () => {
      try {
        const database = await getDatabase();
        setLocalDb(database);
      } catch (err) {
        console.log(err);
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
      } finally {
        setIsLoading(false);
      }
    };

    initDb();
  }, [enabled]);

  return { localDb, isLoading, error };
}