"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncHandler } from '@/lib/rxdb/sync/sync-handler';
import { SyncStatus, SyncFilter, SyncConfig } from '@/lib/rxdb/sync/types';
import { getSyncHandler, clearSyncHandler } from '@/lib/rxdb/sync/sync-store';
import { RxCollection } from 'rxdb';
import { Subscription } from 'rxjs';

export interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  error?: Error;
  lastSyncTime?: Date;
  collections: Map<CollectionName, SyncStatus>;
}

export interface SyncControls {
  startSync: (collections?: CollectionName[]) => Promise<void>;
  stopSync: (collections?: CollectionName[]) => void;
  resetSync: () => Promise<void>;
  addCollection: (
    name: CollectionName,
    collection: RxCollection,
    config?: Partial<SyncConfig>
  ) => Promise<void>;
  removeCollection: (name: CollectionName) => void;
  updateConfig: (name: CollectionName, config: Partial<SyncConfig>) => void;
}

export interface UseSyncHandlerOptions {
  autoStart?: boolean;
  collections?: Map<CollectionName, RxCollection>;
  defaultConfig?: Partial<SyncConfig>;
}

export function useSyncHandler(options: UseSyncHandlerOptions = {}): [SyncState, SyncControls] {
  const { autoStart = true, collections = new Map(), defaultConfig } = options;
  
  // Use refs for mutable values that shouldn't trigger re-renders
  const handler = useRef<SyncHandler>();
  const subscriptions = useRef<Subscription[]>([]);
  
  // State for tracking sync status
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    collections: new Map(),
  });

  // Initialize the sync handler
  useEffect(() => {
    handler.current = getSyncHandler();

    // Subscribe to sync events
    const subscription = handler.current.onSyncEvent().subscribe(event => {
      setState(prevState => {
        const newCollections = new Map(prevState.collections);
        const status = handler.current?.getSyncStatus(event.collection);
        
        if (status) {
          newCollections.set(event.collection, status);
        }

        return {
          ...prevState,
          status: event.type === 'sync-error' ? 'error' : 
                 event.type === 'sync-started' ? 'syncing' : 
                 event.type === 'sync-completed' ? 'idle' : prevState.status,
          error: event.type === 'sync-error' ? event.error : undefined,
          lastSyncTime: event.type === 'sync-completed' ? event.timestamp : prevState.lastSyncTime,
          collections: newCollections,
        };
      });
    });

    subscriptions.current.push(subscription);

    // Initialize collections if provided
    if (collections.size > 0) {
      collections.forEach((collection, name) => {
        handler.current?.addCollection(name, collection, {
          ...defaultConfig,
          enabled: autoStart,
        });
      });
    }

    return () => {
      subscriptions.current.forEach(sub => sub.unsubscribe());
      subscriptions.current = [];
      clearSyncHandler();
    };
  }, []);

  const startSync = useCallback(async (targetCollections?: CollectionName[]) => {
    if (!handler.current) return;

    setState(prev => ({ ...prev, status: 'syncing' }));

    try {
      if (targetCollections) {
        await Promise.all(
          targetCollections.map(name => 
            handler.current?.syncCollection(name)
          )
        );
      } else {
        await handler.current.syncAllCollections();
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        error: error as Error,
      }));
    }
  }, []);

  const stopSync = useCallback((targetCollections?: CollectionName[]) => {
    if (!handler.current) return;

    if (targetCollections) {
      targetCollections.forEach(name => {
        handler.current?.removeCollection(name);
      });
    } else {
      handler.current.cleanup();
    }

    setState(prev => ({ ...prev, status: 'idle' }));
  }, []);

  const resetSync = useCallback(async () => {
    if (!handler.current) return;

    // Clear existing sync state
    handler.current.cleanup();
    
    // Reinitialize handler
    handler.current = getSyncHandler();
    
    // Reset state
    setState({
      status: 'idle',
      collections: new Map(),
    });

    // Restart sync if autoStart is enabled
    if (autoStart) {
      await startSync();
    }
  }, [autoStart, startSync]);

  const addCollection = useCallback(async (
    name: CollectionName,
    collection: RxCollection,
    config?: Partial<SyncConfig>
  ) => {
    if (!handler.current) return;

    await handler.current.addCollection(name, collection, {
      ...defaultConfig,
      ...config,
    });
  }, [defaultConfig]);

  const removeCollection = useCallback((name: CollectionName) => {
    if (!handler.current) return;
    handler.current.removeCollection(name);
    
    setState(prev => {
      const newCollections = new Map(prev.collections);
      newCollections.delete(name);
      return { ...prev, collections: newCollections };
    });
  }, []);

  const updateConfig = useCallback((
    name: CollectionName,
    config: Partial<SyncConfig>
  ) => {
    if (!handler.current) return;
    handler.current.updateConfig(name, config);
  }, []);

  const controls: SyncControls = {
    startSync,
    stopSync,
    resetSync,
    addCollection,
    removeCollection,
    updateConfig,
  };

  return [state, controls];
}