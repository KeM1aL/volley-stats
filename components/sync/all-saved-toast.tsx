"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { INITIAL_ALL_SAVED_TRACKER, trackAllSaved } from "@/lib/rxdb/sync/all-saved";
import type { SyncBadgeState } from "@/lib/rxdb/sync/status";

/**
 * Renders nothing: one toast when the upload queue empties after a wait for a connection. It lives in `SyncStatusProvider`,
 * so it is always mounted, on the website and in the app (which has no header badge), and fires once.
 */
export function AllSavedToast({ state }: { state: SyncBadgeState | null }) {
  const t = useTranslations("sync");
  const { toast } = useToast();
  const tracker = useRef(INITIAL_ALL_SAVED_TRACKER);

  useEffect(() => {
    const result = trackAllSaved(tracker.current, state);
    tracker.current = result.tracker;
    if (result.toast) toast({ title: t("badge.allSavedToast") });
  }, [state, t, toast]);

  return null;
}
