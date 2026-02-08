"use client";

import { createContext, useContext, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocalDatabase } from "@/hooks/use-local-database";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";

const LocalDatabaseContext = createContext<ReturnType<
  typeof useLocalDatabase
> | null>(null);
const inDevEnvironment = !!process && process.env.NODE_ENV === "development";

export function LocalDatabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const tUi = useTranslations("common.ui");
  const tErrors = useTranslations("common.errors.database");
  const { user, isLoading: authLoading } = useAuth();
  const database = useLocalDatabase(!!user && !authLoading);
  const router = useRouter();

  // useEffect(() => {
  //   if (database.localDb && user) {
  //     const syncHandler = new SyncHandler();
  //     const collections = new Map<CollectionName, RxCollection>([
  //       ['championships', database.localDb.championships],
  //       ['seasons', database.localDb.seasons],
  //       ['match_formats', database.localDb.match_formats],
  //       ['clubs', database.localDb.clubs],
  //       ['club_members', database.localDb.club_members],
  //       ['teams', database.localDb.teams],
  //       ['team_members', database.localDb.team_members],
  //       ['matches', database.localDb.matches],
  //       ['sets', database.localDb.sets],
  //       ['events', database.localDb.events],
  //       ['score_points', database.localDb.score_points],
  //       ['player_stats', database.localDb.player_stats],
  //     ]);

  //     syncHandler.initializeSync(collections);

  //     return () => {
  //       syncHandler.cleanup();
  //     };
  //   }
  // }, [database.localDb, user]);

  useEffect(() => {
    if (database.localDb) {
        // Pass user to SyncManager
        console.debug('LocalDatabaseProvider: Setting user for SyncManager', user);
        if ((database.localDb as any).syncManager) {
            (database.localDb as any).syncManager.setUser(user);
            return () => {
                (database.localDb as any).syncManager.cleanup();
            };
        }
    }
  }, [database.localDb, user]);

  const { isOnline } = useOnlineStatus();

  useEffect(() => {
      if (database.localDb && (database.localDb as any).syncManager) {
          (database.localDb as any).syncManager.setOnlineStatus(isOnline);
      }
  }, [database.localDb, isOnline]);

  const clearLocalDatabase = () => {
    const params = new URLSearchParams();
    params.set("remove-database", "true");

    router.push(`/?${params.toString()}`);
  };

  if (database.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (database.error) {
    const errorString = JSON.stringify(database.error, null, 2);
    const isSchemaError =
      errorString.includes("OpenFailedError") ||
      errorString.includes("schema") ||
      errorString.includes("version");

    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 p-8">
        <p className="text-destructive font-semibold">
          {tErrors("initFailed")}
        </p>
        {isSchemaError && (
          <div className="text-sm text-muted-foreground max-w-md text-center">
            <p>
              {tErrors("schemaIncompatible")}
            </p>
            <p className="mt-2">
              {tErrors("resyncInstructions")}
            </p>
          </div>
        )}
        {inDevEnvironment && (
          <pre className="text-xs max-w-2xl overflow-auto">{errorString}</pre>
        )}
        <Button onClick={clearLocalDatabase}>{tUi("clearLocalDatabase")}</Button>
      </div>
    );
  }

  return (
    <LocalDatabaseContext.Provider value={database}>
      {children}
      {/* <SyncIndicator /> */}
    </LocalDatabaseContext.Provider>
  );
}

export function useLocalDb() {
  const context = useContext(LocalDatabaseContext);
  if (!context) {
    // Development-only error: indicates incorrect hook usage
    // Not translated as this is a developer-facing error message
    throw new Error("useLocalDb must be used within a DatabaseProvider");
  }
  return context;
}
