import { Subscription } from 'rxjs';
import { CollectionName } from '../schema';
import { RxCollection } from 'rxdb';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface SyncFilter {
  field: string;
  operator: 'eq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
}

export interface CollectionConfig {
  name: CollectionName;
  filters?: SyncFilter[];
  batchSize?: number;
  syncInterval?: number;
}

export interface CollectionEntry {
  collection: RxCollection;
  config: CollectionConfig;
  channel?: RealtimeChannel;
  subscription?: Subscription;
}

export interface SyncState {
  isOnline: boolean;
  syncInProgress: boolean;
  collections: Map<CollectionName, CollectionEntry>;
}