"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export function SyncIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (wasOffline && isOnline) {
      setIsSyncing(true);
      setProgress(0);
      
      // Simulate sync progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      // Complete sync after progress reaches 100%
      const timer = setTimeout(() => {
        setIsSyncing(false);
        clearInterval(interval);
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [wasOffline, isOnline]);

  useEffect(() => {
    if (!isOnline || isSyncing) {
      setShowStatus(true);
      const timer = setTimeout(() => {
        if (isOnline && !isSyncing) {
          setShowStatus(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSyncing]);

  if (!showStatus) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 flex flex-col gap-2 rounded-lg p-4 shadow-lg transition-colors w-64",
        isOnline
          ? "bg-background border"
          : "bg-destructive text-destructive-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Syncing changes...</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Online</span>
            </>
          )
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline</span>
          </>
        )}
      </div>

      {isSyncing && (
        <Progress 
          value={progress} 
          className="h-1"
        />
      )}
    </div>
  );
}