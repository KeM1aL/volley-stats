import { Subject, Observable } from 'rxjs';
import { SyncEvent, SyncStatus } from './types';
import { CollectionName } from '../schema';

interface LockInfo {
  id: string;
  collection: CollectionName;
  timestamp: number;
  timeout: number;
}

export class SyncContext {
  private static instance: SyncContext;
  private locks: Map<string, LockInfo> = new Map();
  private eventSubject = new Subject<SyncEvent>();
  private statusMap: Map<CollectionName, SyncStatus> = new Map();
  private readonly DEFAULT_LOCK_TIMEOUT = 30000; // 30 seconds

  private constructor() {
    // Private constructor for singleton pattern
    this.startLockCleanup();
  }

  static getInstance(): SyncContext {
    if (!SyncContext.instance) {
      SyncContext.instance = new SyncContext();
    }
    return SyncContext.instance;
  }

  private startLockCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [lockId, lockInfo] of this.locks.entries()) {
        if (now - lockInfo.timestamp > lockInfo.timeout) {
          this.locks.delete(lockId);
          this.emitEvent({
            type: 'sync-lock-released',
            collection: lockInfo.collection,
            timestamp: new Date(),
            data: { lockId }
          });
        }
      }
    }, 5000); // Check every 5 seconds
  }

  async acquireLock(collection: CollectionName, timeout = this.DEFAULT_LOCK_TIMEOUT): Promise<string> {
    const lockId = crypto.randomUUID();
    
    // Check if collection is already locked
    for (const lock of this.locks.values()) {
      if (lock.collection === collection) {
        throw new Error(`Collection ${collection} is already locked`);
      }
    }

    const lockInfo: LockInfo = {
      id: lockId,
      collection,
      timestamp: Date.now(),
      timeout
    };

    this.locks.set(lockId, lockInfo);
    
    this.emitEvent({
      type: 'sync-lock-acquired',
      collection,
      timestamp: new Date(),
      data: { lockId }
    });

    return lockId;
  }

  releaseLock(lockId: string): boolean {
    const lockInfo = this.locks.get(lockId);
    if (!lockInfo) {
      return false;
    }

    this.locks.delete(lockId);
    
    this.emitEvent({
      type: 'sync-lock-released',
      collection: lockInfo.collection,
      timestamp: new Date(),
      data: { lockId }
    });

    return true;
  }

  async withLock<T>(
    collection: CollectionName,
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const lockId = await this.acquireLock(collection, timeout);
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout for collection ${collection}`));
          }, timeout || this.DEFAULT_LOCK_TIMEOUT);
        })
      ]);
      
      return result as T;
    } finally {
      this.releaseLock(lockId);
    }
  }

  updateStatus(collection: CollectionName, status: SyncStatus): void {
    this.statusMap.set(collection, status);
    
    this.emitEvent({
      type: 'sync-status-updated',
      collection,
      timestamp: new Date(),
      data: { status }
    });
  }

  getStatus(collection: CollectionName): SyncStatus | undefined {
    return this.statusMap.get(collection);
  }

  private emitEvent(event: SyncEvent): void {
    this.eventSubject.next(event);
  }

  onEvent(): Observable<SyncEvent> {
    return this.eventSubject.asObservable();
  }

  onCollectionEvent(collection: CollectionName): Observable<SyncEvent> {
    return new Observable<SyncEvent>(subscriber => {
      const subscription = this.eventSubject.subscribe(event => {
        if (event.collection === collection) {
          subscriber.next(event);
        }
      });

      return () => subscription.unsubscribe();
    });
  }

  cleanup(): void {
    this.locks.clear();
    this.eventSubject.complete();
    this.statusMap.clear();
  }
}