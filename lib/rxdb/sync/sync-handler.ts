"use client";

import { RxCollection, RxDocument, RxChangeEvent } from 'rxdb';
import { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { createJsClient } from '@/lib/supabase/client';
import { retryWithBackoff } from '@/lib/utils/retry';
import { CollectionName } from '../schema';
import { Subscription } from 'rxjs';
import { toast } from '@/hooks/use-toast';
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

  async initializeSync(collections: Map<CollectionName, RxCollection>) {
    this.cleanup();
    this.collections = collections;

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
        // const latestRecord = await collection.findOne({
        //   selector: {},
        //   sort: [
        //     {updated_at: 'asc'}
        //   ]
        // }).exec();

        const { data, error } = await this.supabase
          .from(name)
          .select('*')
          // .gte('updated_at', latestRecord?.updated_at ?? new Date(2024, 1, 1).toISOString())
          .order('updated_at', { ascending: false });

        if (error) throw error;

        let failRecords = 0;
        await Promise.all(
          data.map(async (remoteRecord) => {
            try {
              const remoteId = remoteRecord.id;
              const remoteUpdatedAtString = remoteRecord.updated_at;

              if (!remoteId) {
                console.warn(`Skipping record in initial sync for ${name} due to missing ID.`, remoteRecord);
                failRecords++;
                return;
              }

              const localDoc = await collection.findOne(remoteId).exec();

              if (localDoc && remoteUpdatedAtString && localDoc.updated_at) {
                const remoteUpdatedAt = new Date(remoteUpdatedAtString);
                const localDocUpdatedAt = new Date(localDoc.updated_at);

                if (localDocUpdatedAt >= remoteUpdatedAt) {
                  // console.debug(`Skipping initial sync for record ${remoteId} in ${name} as local version is newer or same.`);
                  // If local is newer, queue it for update to Supabase
                  if (localDocUpdatedAt > remoteUpdatedAt) {
                    console.debug(`Queueing local document ${localDoc.id} from ${name} for UPDATE to Supabase as it's newer than server version.`);
                    this.queueChange(name, {
                      operation: 'UPDATE',
                      documentId: localDoc.id,
                      documentData: localDoc.toJSON() as any, // RxDB types might need 'as any' here
                    } as RxChangeEvent<any>); // Cast to RxChangeEvent, ensure required fields are present
                  }
                  return; // Skip upserting this record from server
                }
              }

              // If local doc doesn't exist, or remote is newer.
              // Upsert server record into local DB.
              await collection.upsert({
                ...remoteRecord,
                updated_at: remoteUpdatedAtString || new Date().toISOString()
              });
            } catch (err) {
              console.error(`Error processing record ${remoteRecord.id} in ${name} during initial sync:`, err);
              failRecords++;
            }
          })
        );
        console.log(`Initial sync phase 1 for ${name} complete: ${data.length - failRecords} server records processed, ${failRecords} failures/server records skipped.`);

        // Phase 2: Handle purely local documents
        const allLocalDocs = await collection.find().exec();
        const serverDocIds = new Set(data.map(d => d.id));
        let localDocsQueued = 0;

        for (const localDocInDb of allLocalDocs) {
          if (!serverDocIds.has(localDocInDb.id)) {
            console.debug(`Queueing purely local document ${localDocInDb.id} from ${name} for INSERT to Supabase.`);
            this.queueChange(name, {
              operation: 'INSERT',
              documentId: localDocInDb.id,
              documentData: localDocInDb.toJSON() as any,
            } as RxChangeEvent<any>);
            localDocsQueued++;
          }
        }
        if (localDocsQueued > 0) {
          console.log(`Queued ${localDocsQueued} purely local documents from ${name} for sync to Supabase.`);
        }

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

  private async setupCollectionSync<T extends { id: string, updated_at: string }>(name: CollectionName, collection: RxCollection<T>) {
    const subscription = collection.$.subscribe(async (changeEvent: RxChangeEvent<T>) => {
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
      const remoteId = eventType === 'DELETE' ? oldRecord.id : newRecord.id;
      const remoteUpdatedAtString = eventType === 'DELETE' ? oldRecord.updated_at : newRecord.updated_at;

      if (!remoteId) {
        console.warn('Supabase change came with no ID, skipping:', payload);
        return;
      }

      // LWW for INSERT and UPDATE
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!remoteUpdatedAtString) {
          console.warn(`Skipping incoming Supabase ${eventType} for ${remoteId} in ${collection.name} due to missing updated_at.`, newRecord);
          // Optionally, could upsert if this is acceptable non-LWW behavior for such cases
          return;
        }
        const remoteUpdatedAt = new Date(remoteUpdatedAtString);

        // Check against syncQueue
        const queuedItem = this.syncQueue.find(
          (item) => item.collection === collection.name && item.documentId === remoteId
        );

        if (queuedItem?.data?.updated_at) {
          const queuedLocalUpdatedAt = new Date(queuedItem.data.updated_at as string);
          if (queuedLocalUpdatedAt > remoteUpdatedAt) {
            console.debug(`Skipping incoming Supabase ${eventType} for ${remoteId} in ${collection.name} as a newer local change is already queued.`);
            return;
          }
        }

        // Check against existing local RxDB document
        const localDoc = await collection.findOne(remoteId).exec();
        if (localDoc && localDoc.updated_at) {
          const localDocUpdatedAt = new Date(localDoc.updated_at);
          if (localDocUpdatedAt >= remoteUpdatedAt) {
            console.debug(`Skipping incoming Supabase ${eventType} for ${remoteId} in ${collection.name} as local version is newer or same.`);
            return;
          }
        }

        console.log(`Applying incoming Supabase ${eventType} for ${remoteId} in ${collection.name}`);
        await collection.upsert({
          ...newRecord,
          updated_at: remoteUpdatedAtString // Ensure we use the server's timestamp
        });
      } else if (eventType === 'DELETE') {
        // Handle DELETE
        const queuedItem = this.syncQueue.find(
          (item) => item.collection === collection.name && item.documentId === remoteId
        );
        if (queuedItem) {
          console.warn(`Warning: Deleting ${remoteId} locally in ${collection.name} due to Supabase change, but a pending local change for this document exists in the queue.`, queuedItem);
          // Optional: More advanced handling could remove/modify the queued item.
          // For example, if the queued item is an update for a now-deleted record,
          // it might be safe to remove it from the queue.
          // this.syncQueue = this.syncQueue.filter(item => item !== queuedItem);
        }

        console.log(`Applying incoming Supabase DELETE for ${remoteId} in ${collection.name}`);
        const doc = await collection.findOne(remoteId).exec();
        if (doc) {
          await doc.remove();
        } else {
          console.log(`Document ${remoteId} not found locally, Supabase DELETE change for ${collection.name} might be for a record not yet synced or already deleted locally.`);
        }
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

  private async syncToSupabase<T extends { id: string, updated_at: string }>(
    collectionName: CollectionName,
    changeEvent: RxChangeEvent<T>
  ) {
    const operation = changeEvent.operation;
    const doc = {
      ...changeEvent.documentData
    };
    delete (doc as any)._rev;
    delete (doc as any)._attachments;
    delete (doc as any)._deleted;
    delete (doc as any)._meta;
    try {
      await retryWithBackoff(async () => {
        switch (operation) {
          case 'INSERT':
            const { error: insertError } = await this.supabase
              .from(collectionName)
              .insert(doc);
            if (insertError) {
              // Check for primary key violation (Supabase error code 23505)
              if (insertError.code === '23505') {
                console.log(`Insert conflict for ${doc.id} in ${collectionName}. Checking timestamps.`);
                const { data: existingDoc, error: fetchError } = await this.supabase
                  .from(collectionName)
                  .select('id, updated_at')
                  .eq('id', doc.id)
                  .maybeSingle();

                if (fetchError) {
                  console.error(`Error fetching existing document during insert conflict: ${fetchError.message}`);
                  throw insertError; // Re-throw original insert error
                }

                if (existingDoc && doc.updated_at && existingDoc.updated_at) {
                  if (new Date(doc.updated_at as string) > new Date(existingDoc.updated_at)) {
                    console.log(`Local insert for ${doc.id} is newer. Attempting update.`);
                    const { error: conflictUpdateError } = await this.supabase
                      .from(collectionName)
                      .update(doc)
                      .eq('id', doc.id);
                    if (conflictUpdateError) {
                      console.error(`Error updating document during insert conflict resolution: ${conflictUpdateError.message}`);
                      throw conflictUpdateError;
                    }
                    console.log(`Successfully updated ${doc.id} after insert conflict.`);
                  } else {
                    console.log(`Skipping insert for document ${doc.id} in ${collectionName} as server version is newer or same during conflict.`);
                    // Do nothing, effectively discarding the local insert as it's stale
                  }
                } else {
                  // Should not happen if PK conflict occurred, but handle defensively
                  console.warn(`Insert conflict for ${doc.id} but existing document not found or timestamps missing.`);
                  throw insertError;
                }
              } else {
                throw insertError; // Re-throw other insert errors
              }
            }
            break;

          case 'UPDATE':
            // LWW: Fetch existing doc from Supabase to compare updated_at
            const { data: existingDoc, error: fetchError } = await this.supabase
              .from(collectionName)
              .select('id, updated_at')
              .eq('id', doc.id)
              .maybeSingle();

            if (fetchError) {
              console.error(`Error fetching document ${doc.id} for LWW check: ${fetchError.message}`);
              throw fetchError; // Throw error to be caught by retryWithBackoff
            }

            if (existingDoc && doc.updated_at && existingDoc.updated_at) {
              if (new Date(doc.updated_at as string) <= new Date(existingDoc.updated_at)) {
                console.log(`Skipping update for document ${doc.id} in ${collectionName} as server version is newer or same.`);
                return; // Local change is older or same, so skip update
              }
            } else if (existingDoc && !doc.updated_at) {
                // if local doesn't have updated_at, it's an old record or error, server version wins
                console.log(`Skipping update for document ${doc.id} in ${collectionName} as local version has no updated_at.`);
                return;
            }
            // If existingDoc is null, it means the doc was deleted on the server.
            // Proceed with the update, which might fail or effectively be an insert if RLS allows.
            // Or, if local doc.updated_at is missing, but server one is not (should not happen with existingDoc check)

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

  private queueChange<T>(collectionName: CollectionName, changeEvent: RxChangeEvent<T>) {
    const queueItem: SyncQueueItem = {
      collection: collectionName,
      operation: changeEvent.operation,
      documentId: changeEvent.documentId,
      data: {
        ...changeEvent.documentData
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

    this.rxSubscriptions.forEach(subscription => subscription.unsubscribe());

    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
    }
  }
}