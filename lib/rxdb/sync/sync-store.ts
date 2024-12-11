import { SyncHandler } from './sync-handler';

// Singleton store for SyncHandler instance
let syncHandlerInstance: SyncHandler | null = null;

export function getSyncHandler(): SyncHandler {
  if (!syncHandlerInstance) {
    syncHandlerInstance = new SyncHandler();
  }
  return syncHandlerInstance;
}

export function clearSyncHandler(): void {
  if (syncHandlerInstance) {
    syncHandlerInstance.cleanup();
    syncHandlerInstance = null;
  }
}