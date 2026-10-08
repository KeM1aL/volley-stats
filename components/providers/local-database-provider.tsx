"use client";

import { createContext, useContext, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocalDatabase } from "@/hooks/use-local-database";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { LoadingSpinner } from "../ui/loading-spinner";
import { toSyncUser } from "@/lib/rxdb/sync/manager";

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

  useEffect(() => {
    const manager = database.localDb?.syncManager;
    if (!manager) return;
    // A refreshed profile for the same user is a no-op; signing out keeps local data.
    void manager.setUser(user ? toSyncUser(user) : null);
  }, [database.localDb, user]);

  const clearLocalDatabase = () => {
    const params = new URLSearchParams();
    params.set("remove-database", "true");

    router.push(`/?${params.toString()}`);
  };

  if (database.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
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
