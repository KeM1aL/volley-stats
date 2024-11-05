"use client";

import { RxCollection, RxDocument, RxChangeEvent } from 'rxdb';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { retryWithBackoff } from '@/lib/utils/retry';
import { toast } from 'sonner';
import { CollectionName } from './schema';

interface SyncQueueItem<T = any> {
  collection: CollectionName;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  documentId: string;
  data?: T;
  timestamp: number;
  retryCount: number;
}

class SyncHandler {
  private channels: Map<CollectionName, RealtimeChannel> = new Map();
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private collections: Map<CollectionName, RxCollection> = new Map();
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;
  private queueProcessInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupOnlineListener();
    this.startQueueProcessor();
  }

  private setupOnlineListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
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
    this.isOnline = true;
    toast.success('Connection restored', {
      description: 'Syncing pending changes...'
    });
    await this.processSyncQueue();
    await this.resubscribeToChannels();
    toast.success('Sync completed');
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.channels.forEach(channel => channel.unsubscribe());
    toast.error('Connection lost', {
      description: 'Changes will be synced when connection is restored'
    });
  };

  async initializeSync(collections: Map<CollectionName, RxCollection>) {
    this.collections = collections;
    
    const entries = Array.from(this.collections.entries());
    for (const [name, collection] of entries) {
      await this.setupCollectionSync(name, collection);
    }

    // Initial sync
    if (this.isOnline) {
      await this.performInitialSync();
    }
  }

  private async performInitialSync() {
    const entries = Array.from(this.collections.entries());
    for (const [name, collection] of entries) {
      try {
        const { data, error } = await supabase
          .from(name)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        await Promise.all(
          data.map(async (record) => {
            try {
              await collection.upsert(record);
            } catch (err) {
              console.error(`Error upserting record in ${name}:`, err);
            }
          })
        );
      } catch (error) {
        console.error(`Error during initial sync of ${name}:`, error);
        toast.error(`Failed to sync ${name}`, {
          description: 'Please try refreshing the page'
        });
      }
    }
  }

  private async setupCollectionSync<T extends { id: string }>(name: CollectionName, collection: RxCollection<T>) {
    // Set up change tracking
    collection.$.subscribe(async (changeEvent: RxChangeEvent<T>) => {
      if (!this.isOnline) {
        this.queueChange(name, changeEvent);
        return;
      }

      await this.syncToSupabase(name, changeEvent);
    });

    // Set up Supabase realtime subscription
    const channel = supabase
      .channel(`${name}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: name,
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          await this.handleSupabaseChange(collection, payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to changes in ${name}`);
        }
      });

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
          await collection.upsert(newRecord);
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
      toast.error('Sync error', {
        description: 'Failed to apply remote changes'
      });
    }
  }

  private async syncToSupabase<T extends { id: string }>(
    collectionName: CollectionName,
    changeEvent: RxChangeEvent<T>
  ) {
    const operation = changeEvent.operation;
    const doc = changeEvent.documentData;

    try {
      await retryWithBackoff(async () => {
        switch (operation) {
          case 'INSERT':
            const { error: insertError } = await supabase
              .from(collectionName)
              .insert(doc);
            if (insertError) throw insertError;
            break;

          case 'UPDATE':
            const { error: updateError } = await supabase
              .from(collectionName)
              .update(doc)
              .eq('id', doc.id);
            if (updateError) throw updateError;
            break;

          case 'DELETE':
            const { error: deleteError } = await supabase
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
      toast.error('Sync error', {
        description: 'Changes will be retried automatically'
      });
    }
  }

  private queueChange<T>(collectionName: CollectionName, changeEvent: RxChangeEvent<T>) {
    const queueItem: SyncQueueItem = {
      collection: collectionName,
      operation: changeEvent.operation,
      documentId: changeEvent.documentId,
      data: changeEvent.documentData,
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
        
        // Requeue if under max retries
        if (item.retryCount < this.maxRetries) {
          this.syncQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
            timestamp: Date.now()
          });
        } else {
          toast.error('Sync failed', {
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

      const newChannel = supabase
        .channel(`${name}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: name,
          },
          async (payload) => {
            const collection = this.collections.get(name);
            if (collection) {
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
    
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
    }
  }
}

export const syncHandler = new SyncHandler();