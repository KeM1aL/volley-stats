"use client";

import { useState, useEffect } from 'react';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncMetrics } from '@/lib/rxdb/sync/sync-metrics';

const metrics = new SyncMetrics();

export function useSyncMetrics(collection: CollectionName) {
  const [successRate, setSuccessRate] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Update metrics every 5 seconds
    const interval = setInterval(() => {
      setSuccessRate(metrics.getSuccessRate(collection));
      setAvgDuration(metrics.getAverageDuration(collection));
      setHistory(metrics.getMetrics(collection));
    }, 5000);

    return () => clearInterval(interval);
  }, [collection]);

  return {
    successRate,
    avgDuration,
    history,
    clearMetrics: () => metrics.clear(collection),
  };
}