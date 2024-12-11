import { RxCollection } from 'rxdb';
import { CollectionName } from '../schema';

export type SyncFilter = {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
};

export type SyncConfig = {
  enabled: boolean;
  filters?: SyncFilter[];
  batchSize?: number;
  syncInterval?: number;
  retryAttempts?: number;
};

export type CollectionSyncConfig = {
  [key in CollectionName]?: SyncConfig;
};

export type SyncStatus = {
  collection: CollectionName;
  status: 'idle' | 'syncing' | 'error' | 'completed';
  lastSynced?: Date;
  error?: string;
  progress?: number;
};

export type SyncEvent = {
  type: 'sync-started' | 'sync-completed' | 'sync-error' | 'sync-progress' | 'sync-status-updated' | 'sync-lock-acquired' | 'sync-lock-released';
  collection: CollectionName;
  timestamp: Date;
  data?: any;
  error?: Error;
};