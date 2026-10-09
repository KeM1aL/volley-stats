"use client";

import { createContext, useContext, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocalDatabase } from "@/hooks/use-local-database";
import { useAuth } from "@/contexts/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
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
  const tSync = useTranslations("sync");
  const tActions = useTranslations("common.actions");
  const { user, isLoading: authLoading } = useAuth();
  const database = useLocalDatabase(!!user && !authLoading);

  useEffect(() => {
    const manager = database.localDb?.syncManager;
    if (!manager) return;
    // A refreshed profile for the same user is a no-op; signing out keeps local data.
    void manager.setUser(user ? toSyncUser(user) : null);
  }, [database.localDb, user]);

  // A full load, not a client-side navigation: the database is opened again, reading the flag from the address.
  const clearLocalDatabase = () => {
    window.location.assign(new URL("/?remove-database=true", window.location.origin).href);
  };

  const forceClearLocalDatabase = () => {
    window.location.assign(new URL("/?remove-database=force", window.location.origin).href);
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

    const resetBlocked = database.error.message === "unsentChangesBlockReset";

    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 p-8">
        <p className="text-destructive font-semibold">
          {tErrors("initFailed")}
        </p>
        {resetBlocked && (
          <p className="text-sm text-muted-foreground max-w-md text-center">{tSync("guards.resetBlocked")}</p>
        )}
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
        {resetBlocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="force-reset-database">
                {tSync("guards.forceReset")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tSync("guards.forceResetTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{tSync("guards.forceResetBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={forceClearLocalDatabase} data-testid="force-reset-database-confirm">
                  {tSync("guards.forceResetConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
