import { RxCollection, RxChangeEvent } from 'rxdb';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { retryWithBackoff } from '@/lib/utils/retry';
import { CollectionConfig, CollectionEntry, SyncFilter } from './types';
import { toast } from '@/hooks/use-toast';
import { sanitizeData } from './utils';

export async function setupCollectionSync(
  name: string,
  collection: RxCollection,
  config: CollectionConfig,
  isOnline: boolean
): Promise<CollectionEntry> {
  const subscription = collection.$.subscribe(async (changeEvent) => {
    if (!isOnline) {
      await queueChange(name, changeEvent);
      return;
    }
    await syncToSupabase(name, changeEvent);
  });

  let query = supabase
    .channel(`${name}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: name },
      async (payload) => {
        if (config.filters && !matchesFilters(payload.new, config.filters)) {
          return;
        }
        await handleSupabaseChange(collection, payload);
      }
    )
    .subscribe();

  await performInitialSync(collection, config);

  return {
    collection,
    config,
    subscription,
    channel: query
  };
}

async function syncToSupabase<T extends { id: string }>(name: string, changeEvent: RxChangeEvent<T>) {
  try {
    const { operation, documentData, documentId } = changeEvent;
    const cleanData = sanitizeData(documentData);

    await retryWithBackoff(async () => {
      switch (operation) {
        case 'INSERT':
          await supabase.from(name).insert(cleanData);
          break;
        case 'UPDATE':
          await supabase.from(name).update(cleanData).eq('id', documentId);
          break;
        case 'DELETE':
          await supabase.from(name).delete().eq('id', documentId);
          break;
      }
    });
  } catch (error) {
    console.error(`Failed to sync to Supabase (${name}):`, error);
    await queueChange(name, changeEvent);
  }
}

async function handleSupabaseChange(
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
          updated_at: newRecord.updated_at || new Date().toISOString()
        });
        break;
      case 'DELETE':
        const doc = await collection.findOne(oldRecord.id).exec();
        if (doc) await doc.remove();
        break;
    }
  } catch (error) {
    console.error('Failed to handle Supabase change:', error);
    toast({
      variant: "destructive",
      title: 'Sync error',
      description: 'Failed to apply remote changes'
    });
  }
}

async function performInitialSync(
  collection: RxCollection,
  config: CollectionConfig
) {
  try {
    let query = supabase.from(config.name).select('*');

    if (config.filters) {
      config.filters.forEach(filter => {
        query = query.filter(filter.field, filter.operator, filter.value);
      });
    }

    const { data, error } = await query;
    if (error) throw error;

    const batchSize = config.batchSize || 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await Promise.all(
        batch.map(record =>
          collection.upsert({
            ...record,
            updated_at: record.updated_at || new Date().toISOString()
          })
        )
      );
    }
  } catch (error) {
    console.error(`Initial sync failed for ${config.name}:`, error);
    throw error;
  }
}

function matchesFilters(record: any, filters: SyncFilter[]): boolean {
  return filters.every(filter => {
    const value = record[filter.field];
    switch (filter.operator) {
      case 'eq': return value === filter.value;
      case 'gt': return value > filter.value;
      case 'lt': return value < filter.value;
      case 'gte': return value >= filter.value;
      case 'lte': return value <= filter.value;
      case 'in': return filter.value.includes(value);
      default: return true;
    }
  });
}

async function queueChange<T extends { id: string }>(name: string, changeEvent: RxChangeEvent<T>) {
  // TODO: Implement offline queue storage
  console.log(`Change queued for ${name}:`, changeEvent);
}