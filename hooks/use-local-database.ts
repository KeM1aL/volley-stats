"use client";

import { useState, useEffect } from 'react';
import { getDatabase, type VolleyballDatabase } from '@/lib/rxdb/database';

export function useLocalDatabase() {
  const [db, setDb] = useState<VolleyballDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initDb = async () => {
      try {
        const database = await getDatabase();
        setDb(database);
      } catch (err) {
        console.log(err);
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
      } finally {
        setIsLoading(false);
      }
    };

    initDb();
  }, []);

  return { db, isLoading, error };
}