import { RxCollection, RxChangeEvent } from 'rxdb';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { CollectionName } from '../schema';
import { CollectionConfig, CollectionEntry, SyncState } from './types';
import { ConnectionHandler } from './connection-handler';
import { setupCollectionSync } from './collection-sync';
import { sanitizeData } from './utils';

export class SyncManager {
  private state: SyncState = {
    isOnline: true,
    syncInProgress: false,
    collections: new Map()
  };

  private connectionHandler: ConnectionHandler;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor() {
    this.connectionHandler = new ConnectionHandler(
      this.handleOnline.bind(this),
      this.handleOffline.bind(this)
    );
  }

  private async handleOnline(): Promise<void> {
    this.state.isOnline = true;
    this.reconnectAttempts = 0;
    await this.reconnectCollections();
  }

  private handleOffline(): void {
    this.state.isOnline = false;
    this.cleanupChannels();
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
          this.state.isOnline
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
          this.state.isOnline
        );
        this.state.collections.set(name, updatedEntry);
      } catch (error) {
        console.error(`Failed to reconnect collection ${name}:`, error);
        // Continue with other collections even if one fails
      }
    }
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

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }
}