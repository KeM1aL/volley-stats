"use client";

import { useEffect, useState } from 'react';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncHandler } from '@/lib/rxdb/sync/sync-handler';
import { SyncStatus, SyncConfig } from '@/lib/rxdb/sync/types';
import { SyncConfigForm } from './sync-config-form';
import { SyncStatusComponent } from './sync-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SyncManagerProps {
  syncHandler: SyncHandler;
  collections: CollectionName[];
}

export function SyncManager({ syncHandler, collections }: SyncManagerProps) {
  const [statuses, setStatuses] = useState<Map<CollectionName, SyncStatus>>(new Map());

  useEffect(() => {
    const subscription = syncHandler.onSyncEvent().subscribe(event => {
      const status = syncHandler.getSyncStatus(event.collection);
      if (status) {
        setStatuses(new Map(statuses.set(event.collection, status)));
      }
    });

    return () => subscription.unsubscribe();
  }, [syncHandler, statuses]);

  const handleConfigSubmit = (collection: CollectionName, config: SyncConfig) => {
    if (config.enabled) {
      // Re-enable sync for the collection
      syncHandler.addCollection(collection, collections[collection], config);
    } else {
      // Disable sync for the collection
      syncHandler.removeCollection(collection);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status">
          <TabsList>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-6">
            {collections.map(collection => {
              const status = statuses.get(collection) || {
                collection,
                status: 'idle',
              };

              return (
                <Card key={collection}>
                  <CardContent className="pt-6">
                    <SyncStatusComponent
                      collection={collection}
                      status={status}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            {collections.map(collection => (
              <Card key={collection}>
                <CardHeader>
                  <CardTitle>{collection}</CardTitle>
                </CardHeader>
                <CardContent>
                  <SyncConfigForm
                    collection={collection}
                    onSubmit={handleConfigSubmit}
                  />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}