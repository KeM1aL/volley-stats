import { CollectionName } from '../schema';

interface SyncMetric {
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

export class SyncMetrics {
  private metrics: Map<CollectionName, SyncMetric[]> = new Map();
  private readonly MAX_HISTORY = 100;

  recordSync(collection: CollectionName, duration: number, success: boolean, error?: string) {
    const metric: SyncMetric = {
      timestamp: Date.now(),
      duration,
      success,
      error,
    };

    const collectionMetrics = this.metrics.get(collection) || [];
    collectionMetrics.push(metric);

    // Keep only the last MAX_HISTORY metrics
    if (collectionMetrics.length > this.MAX_HISTORY) {
      collectionMetrics.shift();
    }

    this.metrics.set(collection, collectionMetrics);
  }

  getMetrics(collection: CollectionName): SyncMetric[] {
    return this.metrics.get(collection) || [];
  }

  getSuccessRate(collection: CollectionName): number {
    const metrics = this.metrics.get(collection);
    if (!metrics || metrics.length === 0) return 0;

    const successful = metrics.filter(m => m.success).length;
    return (successful / metrics.length) * 100;
  }

  getAverageDuration(collection: CollectionName): number {
    const metrics = this.metrics.get(collection);
    if (!metrics || metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  clear(collection?: CollectionName) {
    if (collection) {
      this.metrics.delete(collection);
    } else {
      this.metrics.clear();
    }
  }
}