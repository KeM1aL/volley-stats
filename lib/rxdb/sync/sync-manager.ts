import { RxCollection, RxChangeEvent } from 'rxdb';
import { CollectionName } from '../schema';
import { CollectionConfig, CollectionEntry, SyncQueueItem, SyncState } from './types';
import { ConnectionHandler } from './connection-handler';
import { setupCollectionSync, syncToSupabase } from './collection-sync';
import { toast } from '@/hooks/use-toast';

export class SyncManager {

  private state: SyncState = {
    isOnline: true,
    syncInProgress: false,
    collections: new Map(),
    syncQueue: []
  };

  private connectionHandler: ConnectionHandler;
  private queueProcessInterval: NodeJS.Timeout | null = null;
  private static instance: SyncManager | null = null;

  private constructor() {
    this.connectionHandler = new ConnectionHandler(
      this.handleOnline.bind(this),
      this.handleOffline.bind(this)
    );
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private startQueueProcessor() {
    // Process queue every 30 seconds
    this.queueProcessInterval = setInterval(() => {
      if (this.state.isOnline && this.state.syncQueue.length > 0) {
        this.processSyncQueue().catch(console.error);
      }
    }, 30000);
  }

  private async handleOnline(): Promise<void> {
    this.state.isOnline = true;

    const { id: toastId, update } = toast({
      title: 'Connection restored',
      description: 'Syncing pending changes...',
      duration: Infinity
    });
    try {
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
      await this.reconnectCollections();
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
  }

  private handleOffline(): void {
    this.state.isOnline = false;
    this.cleanupChannels();
    toast({
      variant: "destructive",
      title: 'Connection lost',
      description: 'Changes will be synced when connection is restored',
    });
  }

  async addCollection(config: CollectionConfig, collection: RxCollection): Promise<void> {
    try {
      // Validate collection schema
      if (!collection.schema) {
        throw new Error(`Invalid schema for collection ${config.name}`);
      }

      // Remove existing sync if present
      await this.removeCollection(config.name);

      // Setup collection sync if online
      let entry: CollectionEntry = {
        collection,
        config
      };

      if (this.state.isOnline) {
        entry = await setupCollectionSync(
          config.name,
          collection,
          config,
          this.state.isOnline,
          this.queueChange.bind(this)
        );
      }

      // Store collection entry
      this.state.collections.set(config.name, entry);
    } catch (error) {
      console.error(`Failed to add collection ${config.name}:`, error);
      throw error;
    }
  }

  async removeCollection(name: CollectionName): Promise<void> {
    const existing = this.state.collections.get(name);
    if (existing) {
      existing.subscription?.unsubscribe();
      existing.channel?.unsubscribe();
      this.state.collections.delete(name);
    }
  }

  private async reconnectCollections(): Promise<void> {
    for (const [name, entry] of this.state.collections.entries()) {
      try {
        const updatedEntry = await setupCollectionSync(
          name,
          entry.collection,
          entry.config,
          this.state.isOnline,
          this.queueChange.bind(this)
        );
        this.state.collections.set(name, updatedEntry);
      } catch (error) {
        console.error(`Failed to reconnect collection ${name}:`, error);
        // Continue with other collections even if one fails
      }
    }
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

    this.state.syncQueue.push(queueItem);
    if(!this.queueProcessInterval) {
      this.startQueueProcessor();
    }
  }

  private async processSyncQueue() {
    if (this.state.syncInProgress || !this.state.isOnline) return;

    this.state.syncInProgress = true;
    const queue = [...this.state.syncQueue];
    this.state.syncQueue = [];

    for (const item of queue) {
      const collection = this.state.collections.get(item.collection);
      if (!collection) continue;

      try {
        await syncToSupabase(item.collection, {
          operation: item.operation,
          documentData: item.data,
          documentId: item.documentId,
        } as RxChangeEvent<any>,
        this.queueChange.bind(this)
      );
      } catch (error) {
        console.error('Error processing sync queue:', error);

        if (item.retryCount < 3) {
          this.state.syncQueue.push({
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

    this.state.syncInProgress = false;
  }

  private cleanupChannels(): void {
    for (const entry of this.state.collections.values()) {
      entry.channel?.unsubscribe();
    }
  }

  cleanup(): void {
    this.connectionHandler.cleanup();
    this.cleanupChannels();
    
    for (const entry of this.state.collections.values()) {
      entry.subscription?.unsubscribe();
    }

    if (this.queueProcessInterval) {
      clearTimeout(this.queueProcessInterval);
    }
  }
}