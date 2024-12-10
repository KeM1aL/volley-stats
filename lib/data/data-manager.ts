import { createClient } from '../supabase/client';
import { getDatabase } from '../rxdb/database';
import { DataLoadingOptions, DataOperationResult, DataSource } from './types';
import { retryWithBackoff } from '../utils/retry';
import { CollectionName } from '../rxdb/schema';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { RxCollection, RxDocument, MangoQuery } from 'rxdb';

export class DataManager {
  private static instance: DataManager;
  private isOnline: boolean = true;
  private pendingOperations: Array<() => Promise<void>> = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  private handleOnline = async () => {
    this.isOnline = true;
    await this.processPendingOperations();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  private async processPendingOperations() {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        console.error('Failed to process pending operation:', error);
        this.pendingOperations.push(operation);
      }
    }
  }

  async loadData<T extends { id: string }>(
    collection: CollectionName,
    query: string | string[] | { [key: string]: any },
    options: DataLoadingOptions = {}
  ): Promise<DataOperationResult<T[]>> {
    try {
      if (this.isOnline && options.forceSource !== 'rxdb') {
        return await this.loadFromSupabase<T>(collection, query, options);
      }
      return await this.loadFromRxDB<T>(collection, query);
    } catch (error) {
      if (this.isOnline) {
        return await this.loadFromRxDB<T>(collection, query);
      }
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to load data'),
        source: 'rxdb'
      };
    }
  }

  private async loadFromSupabase<T extends { id: string }>(
    collection: CollectionName,
    query: string | string[] | { [key: string]: any },
    options: DataLoadingOptions
  ): Promise<DataOperationResult<T[]>> {
    try {
      const supabase = createClient();
      let queryBuilder = supabase.from(collection).select('*');

      if (Array.isArray(query)) {
        // Handle array of IDs
        queryBuilder = queryBuilder.in('id', query);
      } else if (typeof query === 'string') {
        // Handle single ID
        queryBuilder = queryBuilder.eq('id', query);
      } else if (typeof query === 'object') {
        // Handle query object
        Object.entries(query).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            queryBuilder = queryBuilder.eq(key, value);
          }
        });
      }

      const { data, error } = await retryWithBackoff(
        async () => await queryBuilder,
        options.retryAttempts
      );

      if (error) throw error;

      // Sync with RxDB
      await this.syncWithRxDB(collection, data);

      return {
        data: data as T[],
        error: null,
        source: 'supabase'
      };
    } catch (error) {
      throw error;
    }
  }

  private async loadFromRxDB<T extends { id: string }>(
    collection: CollectionName,
    query: string | string[] | { [key: string]: any }
  ): Promise<DataOperationResult<T[]>> {
    try {
      const db = await getDatabase();
      const rxCollection = db[collection];
      let mangoQuery: MangoQuery;

      if (Array.isArray(query)) {
        mangoQuery = {
          selector: {
            id: {
              $in: query
            }
          }
        };
      } else if (typeof query === 'string') {
        mangoQuery = {
          selector: {
            id: query
          }
        };
      } else {
        mangoQuery = {
          selector: query
        };
      }

      const docs = await rxCollection.find(mangoQuery).exec();

      return {
        data: docs.map(doc => doc.toJSON()) as T[],
        error: null,
        source: 'rxdb'
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to load from RxDB'),
        source: 'rxdb'
      };
    }
  }

  private async syncWithRxDB<T extends { id: string }>(
    collection: CollectionName,
    data: T[]
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const rxCollection = db[collection];

      await Promise.all(
        data.map(async (item) => {
          await rxCollection.upsert({
            ...item,
            updated_at: item.updated_at || new Date().toISOString()
          });
        })
      );
    } catch (error) {
      console.error('Failed to sync with RxDB:', error);
    }
  }

  queueOperation(operation: () => Promise<void>): void {
    this.pendingOperations.push(operation);
  }

  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}