import { RxCollection, RxDocument } from 'rxdb';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { retryWithBackoff } from '@/lib/utils/retry';
import { toast } from 'sonner';
import { CollectionName } from '../schema';
import { SyncConfigManager } from './sync-config';
import { SyncEventEmitter } from './sync-events';
import { SyncStatus, SyncEvent, SyncFilter, SyncConfig } from './types';
import { Observable } from 'rxjs';

export class SyncHandler {
  private channels: Map<CollectionName, RealtimeChannel> = new Map();
  private collections: Map<CollectionName, RxCollection> = new Map();
  private syncStatus: Map<CollectionName, SyncStatus> = new Map();
  private configManager: SyncConfigManager;
  private eventEmitter: SyncEventEmitter;
  private isOnline: boolean = true;

  constructor() {
    this.configManager = new SyncConfigManager();
    this.eventEmitter = new SyncEventEmitter();
    this.setupOnlineListener();
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.isOnline = navigator.onLine;
    }
  }

  private handleOnline = async () => {
    this.isOnline = true;
    await this.syncAllCollections();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.channels.forEach(channel => channel.unsubscribe());
  };

  updateConfig(name: CollectionName, config: Partial<SyncConfig>): void {
    this.configManager.updateConfig(name, config);
  }

  async addCollection(
    name: CollectionName,
    collection: RxCollection,
    config?: Partial<SyncConfig>
  ): Promise<void> {
    this.collections.set(name, collection);
    this.configManager.addCollection(name, {
      ...config,
      enabled: true,
      batchSize: 100,
      syncInterval: 30000,
      retryAttempts: 3,
    });

    await this.setupCollectionSync(name, collection);
    await this.syncCollection(name);
  }

  removeCollection(name: CollectionName): void {
    const channel = this.channels.get(name);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(name);
    }
    this.collections.delete(name);
    this.configManager.removeCollection(name);
    this.syncStatus.delete(name);
  }

  private async setupCollectionSync(name: CollectionName, collection: RxCollection): Promise<void> {
    const channel = supabase
      .channel(`${name}_changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: name },
        async (payload) => {
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const config = this.configManager.getConfig(name);

            if (!config?.enabled) return;

            if (config.filters && !this.matchesFilters(newRecord, config.filters)) {
              return;
            }

            switch (eventType) {
              case 'INSERT':
              case 'UPDATE':
                await collection.upsert({
                  ...newRecord,
                  updated_at: newRecord.updated_at || new Date().toISOString(),
                });
                break;
              case 'DELETE':
                const doc = await collection.findOne(oldRecord.id).exec();
                if (doc) await doc.remove();
                break;
            }

            this.emitSyncEvent({
              type: 'sync-completed',
              collection: name,
              timestamp: new Date(),
              data: { eventType, record: newRecord || oldRecord },
            });
          } catch (error) {
            this.handleSyncError(name, error as Error);
          }
        }
      )
      .subscribe();

    this.channels.set(name, channel);
  }

  async syncCollection(name: CollectionName): Promise<void> {
    const collection = this.collections.get(name);
    const config = this.configManager.getConfig(name);

    if (!collection || !config?.enabled || !this.isOnline) return;

    try {
      this.updateSyncStatus(name, { status: 'syncing', progress: 0 });
      this.emitSyncEvent({
        type: 'sync-started',
        collection: name,
        timestamp: new Date(),
      });

      let query = supabase.from(name).select('*');

      if (config.filters) {
        query = this.applyFilters(query, config.filters);
      }

      const { data, error } = await query;

      if (error) throw error;

      let progress = 0;
      const total = data.length;

      for (const record of data) {
        await collection.upsert({
          ...record,
          updated_at: record.updated_at || new Date().toISOString(),
        });

        progress++;
        const progressPercent = (progress / total) * 100;
        this.updateSyncStatus(name, { progress: progressPercent });
        this.emitSyncEvent({
          type: 'sync-progress',
          collection: name,
          timestamp: new Date(),
          data: { progress: progressPercent },
        });
      }

      this.updateSyncStatus(name, {
        status: 'completed',
        lastSynced: new Date(),
        progress: 100,
      });

      this.emitSyncEvent({
        type: 'sync-completed',
        collection: name,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleSyncError(name, error as Error);
    }
  }

  private matchesFilters(record: any, filters: SyncFilter[]): boolean {
    return filters.every(filter => {
      const value = record[filter.field];
      switch (filter.operator) {
        case 'eq': return value === filter.value;
        case 'gt': return value > filter.value;
        case 'lt': return value < filter.value;
        case 'gte': return value >= filter.value;
        case 'lte': return value <= filter.value;
        case 'in': return filter.value.includes(value);
        case 'contains': return value?.includes(filter.value);
        default: return true;
      }
    });
  }

  private applyFilters(query: any, filters: SyncFilter[]): any {
    filters.forEach(filter => {
      switch (filter.operator) {
        case 'eq': query = query.eq(filter.field, filter.value); break;
        case 'gt': query = query.gt(filter.field, filter.value); break;
        case 'lt': query = query.lt(filter.field, filter.value); break;
        case 'gte': query = query.gte(filter.field, filter.value); break;
        case 'lte': query = query.lte(filter.field, filter.value); break;
        case 'in': query = query.in(filter.field, filter.value); break;
        case 'contains': query = query.ilike(filter.field, `%${filter.value}%`); break;
      }
    });
    return query;
  }

  private handleSyncError(collection: CollectionName, error: Error): void {
    console.error(`Sync error for ${collection}:`, error);
    
    this.updateSyncStatus(collection, {
      status: 'error',
      error: error.message,
    });

    this.emitSyncEvent({
      type: 'sync-error',
      collection,
      timestamp: new Date(),
      error,
    });

    toast.error(`Sync error for ${collection}`, {
      description: error.message,
    });
  }

  private updateSyncStatus(collection: CollectionName, update: Partial<SyncStatus>): void {
    const current = this.syncStatus.get(collection) || {
      collection,
      status: 'idle',
    };

    this.syncStatus.set(collection, {
      ...current,
      ...update,
    });
  }

  private emitSyncEvent(event: SyncEvent): void {
    this.eventEmitter.emit(event);
  }

  async syncAllCollections(): Promise<void> {
    const collections = Array.from(this.collections.keys());
    for (const collection of collections) {
      if (this.configManager.isCollectionEnabled(collection)) {
        await this.syncCollection(collection);
      }
    }
  }

  getSyncStatus(collection: CollectionName): SyncStatus | undefined {
    return this.syncStatus.get(collection);
  }

  onSyncEvent(): Observable<SyncEvent> {
    return this.eventEmitter.onEvent();
  }

  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    this.channels.forEach(channel => channel.unsubscribe());
  }
}