import { CollectionName } from '../schema';
import { SyncEvent } from './types';
import { retryWithBackoff } from '@/lib/utils/retry';

export interface QueueItem {
  id: string;
  collection: CollectionName;
  operation: 'sync' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  retryCount: number;
  priority: number;
}

export class SyncQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;
  private onEvent?: (event: SyncEvent) => void;

  constructor(onEvent?: (event: SyncEvent) => void) {
    this.onEvent = onEvent;
  }

  enqueue(item: Omit<QueueItem, 'id' | 'timestamp' | 'retryCount'>) {
    const queueItem: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Insert based on priority
    const index = this.queue.findIndex(i => i.priority < item.priority);
    if (index === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(index, 0, queueItem);
    }

    this.processQueue();
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        await this.processItem(item);
        this.queue.shift(); // Remove processed item
      } catch (error) {
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          item.timestamp = Date.now();
          // Move to end of same priority group
          this.queue.shift();
          const index = this.queue.findIndex(i => i.priority < item.priority);
          if (index === -1) {
            this.queue.push(item);
          } else {
            this.queue.splice(index, 0, item);
          }
        } else {
          this.queue.shift();
          this.emitEvent({
            type: 'sync-error',
            collection: item.collection,
            timestamp: new Date(),
            error: error as Error,
          });
        }
      }
    }

    this.processing = false;
  }

  private async processItem(item: QueueItem) {
    await retryWithBackoff(async () => {
      // Process based on operation type
      switch (item.operation) {
        case 'sync':
          this.emitEvent({
            type: 'sync-started',
            collection: item.collection,
            timestamp: new Date(),
          });
          // Sync logic would go here
          break;
        case 'update':
          // Update logic would go here
          break;
        case 'delete':
          // Delete logic would go here
          break;
      }
    }, this.maxRetries);
  }

  private emitEvent(event: SyncEvent) {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  clear() {
    this.queue = [];
    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getPendingOperations(collection?: CollectionName): QueueItem[] {
    return collection
      ? this.queue.filter(item => item.collection === collection)
      : [...this.queue];
  }
}