"use client";

import { RxCollection, RxDocument, RxChangeEvent } from 'rxdb';
import { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { createJsClient } from '@/lib/supabase/client';
import { retryWithBackoff } from '@/lib/utils/retry';
import { CollectionName } from '../schema';
import { Subscription } from 'rxjs';
import { toast } from '@/hooks/use-toast';
import { CollectionConfig, SyncFilter } from './types';
import { update } from 'rxdb/plugins/update';

interface SyncQueueItem<T = any> {
  collection: CollectionName;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  documentId: string;
  data?: T;
  timestamp: number;
  retryCount: number;
}

export class SyncHandler {
  private supabase: SupabaseClient;
  private channels: Map<CollectionName, RealtimeChannel> = new Map();
  private rxSubscriptions: Map<CollectionName, Subscription> = new Map();
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private collections: Map<CollectionName, RxCollection> = new Map();
  private configs: Map<CollectionName, CollectionConfig> = new Map();
  private syncInProgress: boolean = false;
  private syncFromSupabase: boolean;
  private maxRetries: number = 3;
  private queueProcessInterval: NodeJS.Timeout | null = null;

  constructor(syncFromSupabase = false) {
    this.supabase = createJsClient();
    this.syncFromSupabase = syncFromSupabase;
    this.setupOnlineListener();
    this.startQueueProcessor();
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      console.log('setting up online listener');
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  private startQueueProcessor() {
    // Process queue every 30 seconds
    this.queueProcessInterval = setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.processSyncQueue().catch(console.error);
      }
    }, 30000);
  }

  private handleOnline = async () => {
    const { id: toastId, update } = toast({
      title: 'Connection restored',
      description: 'Syncing pending changes...',
      duration: Infinity
    });
    try {
      this.isOnline = true;
      update({
        id: toastId,
        title: 'Syncing',
        description: 'Processing pending changes...'
      });
      await this.processSyncQueue();
      update({
        id: toastId,
        title: 'Syncing',
        description: 'Reconnecting to real-time updates...'
      });
      await this.resubscribeToChannels();
      update({
        id: toastId,
        title: 'Sync completed',
        description: 'All changes have been synchronized',
        duration: 5000
      });
    } catch (e) {
      console.error(e);
      update({
        id: toastId,
        title: 'Sync failed',
        description: 'Failed to synchronize changes. Will retry automatically.',
        duration: 5000
      });
    }
  };

  private handleOffline = () => {
    try {
      this.isOnline = false;
      this.channels.forEach(channel => channel.unsubscribe());
      toast({
        variant: "destructive",
        title: 'Connection lost',
        description: 'Changes will be synced when connection is restored',
      });
    } catch (e) {
      console.error(e);
    }
  };

  async initializeSync(collections: Map<CollectionName, RxCollection>, configs?: Map<CollectionName, CollectionConfig>) {
    this.cleanup();
    this.collections = collections;
    if (configs) {
      this.configs = configs;
    }

    if (this.isOnline) {
      await this.performInitialSync();
    }

    const entries = Array.from(this.collections.entries());
    for (const [name, collection] of entries) {
      await this.setupCollectionSync(name, collection);
    }
  }

  private async performInitialSync() {
    const entries = Array.from(this.collections.entries());
    for (const [name, collection] of entries) {
      try {
        const latestRecordDoc = await collection.findOne({
          selector: {},
          sort: [
            {updated_at: 'asc'}
          ]
        }).exec();
        const latestRecord = latestRecordDoc?.toJSON();
        console.log('latest', latestRecord);
        const updatedAt = latestRecord?.updated_at || new Date(2024, 1, 1).toISOString();
        let query = this.supabase
          .from(name)
          .select('*')
          .gte('updated_at', updatedAt)
          .order('updated_at', { ascending: false });
        const config = this.configs.get(name);
        if (config && config.filters) {
          query = this.applyFilters(query, config.filters);
        }

        const { data, error } = await query;

        if (error) throw error;

        let failRecords = 0;
        await Promise.all(
          data.map(async (record) => {
            try {
              await collection.upsert({
                ...record,
                updated_at: record.updated_at || new Date().toISOString(),
                origin: 'supabase'
              });
            } catch (err) {
              console.error(`Error upserting record in ${name}:`, err);
              failRecords++;
            }
          })
        );
        console.log(`Initial sync of ${name} complete with ${data.length} records`);
      } catch (error) {
        console.error(`Error during initial sync of ${name}:`, error);
        toast({
          variant: "destructive",
          title: `Failed to sync ${name}`,
          description: 'Please try refreshing the page'
        });
      }
    }
  }

  private async setupCollectionSync<T extends { id: string, origin: string }>(name: CollectionName, collection: RxCollection<T>) {
    const subscription = collection.$.subscribe(async (changeEvent: RxChangeEvent<T>) => {
      if(changeEvent.documentData.origin === 'supabase') return;
      if (!this.isOnline) {
        this.queueChange(name, changeEvent);
        return;
      }

      await this.syncToSupabase(name, changeEvent);
    });
    this.rxSubscriptions.set(name, subscription);

    if (!this.syncFromSupabase) return;
    const channel = this.supabase
      .channel(`${name}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: name,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const config = this.configs.get(name);
          if (config && config.filters && !this.matchesFilters(payload.new, config.filters)) {
            return;
          }
          await this.handleSupabaseChange(collection, payload);
        }
      )
      .subscribe();

    this.channels.set(name, channel);
  }

  private async handleSupabaseChange(
    collection: RxCollection,
    payload: RealtimePostgresChangesPayload<any>
  ) {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT':
        case 'UPDATE':
          await collection.upsert({
            ...newRecord,
            updated_at: newRecord.updated_at || new Date().toISOString(),
            origin: 'supabase'
          });
          break;
        case 'DELETE':
          const doc = await collection.findOne(oldRecord.id).exec();
          if (doc) {
            await doc.remove();
          }
          break;
      }
    } catch (error) {
      console.error('Error handling Supabase change:', error);
      toast({
        variant: "destructive",
        title: 'Sync error',
        description: 'Failed to apply remote changes'
      });
    }
  }

  private sanitizeData(data: any) {
    const clean = { ...data };
    delete clean._rev;
    delete clean._attachments;
    delete clean._deleted;
    delete clean._meta;
    delete clean.origin;
    return clean;
  }

  private async syncToSupabase<T extends { id: string }>(
    collectionName: CollectionName,
    changeEvent: RxChangeEvent<T>
  ) {
    console.log('syncToSupabase', changeEvent);
    const operation = changeEvent.operation;
    const doc = this.sanitizeData(changeEvent.documentData);
    try {
      await retryWithBackoff(async () => {
        switch (operation) {
          case 'INSERT':
            const { error: insertError } = await this.supabase
              .from(collectionName)
              .insert(doc);
            if (insertError) throw insertError;
            break;

          case 'UPDATE':
            const { error: updateError } = await this.supabase
              .from(collectionName)
              .update(doc)
              .eq('id', doc.id);
            if (updateError) throw updateError;
            break;

          case 'DELETE':
            const { error: deleteError } = await this.supabase
              .from(collectionName)
              .delete()
              .eq('id', doc.id);
            if (deleteError) throw deleteError;
            break;
        }
      });
    } catch (error) {
      console.error('Error syncing to Supabase:', error);
      this.queueChange(collectionName, changeEvent);
      toast({
        variant: "destructive",
        title: 'Sync error',
        description: 'Changes will be retried automatically'
      });
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

  private queueChange<T>(collectionName: CollectionName, changeEvent: RxChangeEvent<T>) {
    const queueItem: SyncQueueItem = {
      collection: collectionName,
      operation: changeEvent.operation,
      documentId: changeEvent.documentId,
      data: {
        ...changeEvent.documentData,
        updated_at: new Date().toISOString()
      },
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(queueItem);
  }

  private async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of queue) {
      const collection = this.collections.get(item.collection);
      if (!collection) continue;

      try {
        await this.syncToSupabase(item.collection, {
          operation: item.operation,
          documentData: item.data,
          documentId: item.documentId,
        } as RxChangeEvent<any>);
      } catch (error) {
        console.error('Error processing sync queue:', error);

        if (item.retryCount < this.maxRetries) {
          this.syncQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
            timestamp: Date.now()
          });
        } else {
          toast({
            variant: "destructive",
            title: 'Sync failed',
            description: `Failed to sync changes to ${item.collection} after multiple attempts`
          });
        }
      }
    }

    this.syncInProgress = false;
  }

  private async resubscribeToChannels() {
    const channels = Array.from(this.channels.entries());
    for (const [name, oldChannel] of channels) {
      oldChannel.unsubscribe();

      const newChannel = this.supabase
        .channel(`${name}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: name,
            // filter: ''
          },
          async (payload) => {
            const collection = this.collections.get(name);
            if (collection) {
              const config = this.configs.get(name);
              if (config && config.filters && !this.matchesFilters(payload.new, config.filters)) {
                return;
              }
              await this.handleSupabaseChange(collection, payload);
            }
          }
        )
        .subscribe();

      this.channels.set(name, newChannel);
    }
  }

  cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    this.channels.forEach(channel => channel.unsubscribe());

    this.rxSubscriptions.forEach(subscription => subscription.unsubscribe());

    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
    }
  }
}