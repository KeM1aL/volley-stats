"use client";

import { useEffect, useState } from 'react';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncStatus } from '@/lib/rxdb/sync/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface SyncStatusProps {
  collection: CollectionName;
  status: SyncStatus;
}

export function SyncStatusComponent({ collection, status }: SyncStatusProps) {
  const [progress, setProgress] = useState(status.progress || 0);

  useEffect(() => {
    setProgress(status.progress || 0);
  }, [status.progress]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{collection}</h3>
        <Badge
          variant={
            status.status === 'completed'
              ? 'default'
              : status.status === 'error'
              ? 'destructive'
              : 'secondary'
          }
        >
          {status.status}
        </Badge>
      </div>

      {status.status === 'syncing' && (
        <Progress value={progress} className="w-full" />
      )}

      {status.lastSynced && (
        <p className="text-sm text-muted-foreground">
          Last synced: {format(new Date(status.lastSynced), 'PPpp')}
        </p>
      )}

      {status.error && (
        <p className="text-sm text-destructive">{status.error}</p>
      )}
    </div>
  );
}