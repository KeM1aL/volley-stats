"use client";

import { useEffect, useState } from 'react';
import { useSyncHandler } from '@/hooks/use-sync-handler';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncIndicatorProps {
  className?: string;
}

export function SyncIndicator({ className }: SyncIndicatorProps) {
  const [state] = useSyncHandler();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (state.error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {state.status === 'syncing' && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <Badge
        variant={
          state.status === 'error' ? 'destructive' :
          state.status === 'syncing' ? 'secondary' :
          'default'
        }
      >
        {state.status === 'error' && showError ? 'Sync Error' :
         state.status === 'syncing' ? 'Syncing...' :
         'Synced'}
      </Badge>
    </div>
  );
}