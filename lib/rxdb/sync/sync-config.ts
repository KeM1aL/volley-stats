import { CollectionSyncConfig, SyncConfig } from './types';
import { CollectionName } from '../schema';

export class SyncConfigManager {
  private config: CollectionSyncConfig = {};

  constructor(initialConfig?: CollectionSyncConfig) {
    this.config = initialConfig || {};
  }

  addCollection(collection: CollectionName, config: SyncConfig): void {
    this.config[collection] = {
      ...config,
      enabled: true,
    };
  }

  removeCollection(collection: CollectionName): void {
    delete this.config[collection];
  }

  updateConfig(collection: CollectionName, config: Partial<SyncConfig>): void {
    if (this.config[collection]) {
      this.config[collection] = {
        ...this.config[collection]!,
        ...config,
      };
    }
  }

  getConfig(collection: CollectionName): SyncConfig | undefined {
    return this.config[collection];
  }

  getAllConfigs(): CollectionSyncConfig {
    return { ...this.config };
  }

  isCollectionEnabled(collection: CollectionName): boolean {
    return !!this.config[collection]?.enabled;
  }
}