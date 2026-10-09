"use client";

import { useTranslations } from "next-intl";
import { CloudUpload, TriangleAlert } from "lucide-react";
import type { MatchSyncSummary } from "@/lib/rxdb/sync/status";

/** Small marker on a match whose changes aren't on the server yet. */
export function SyncFlag({ summary }: { summary?: MatchSyncSummary }) {
  const t = useTranslations("sync");
  if (!summary) return null;
  if (summary.rejected > 0) {
    return (
      <span
        title={t("flag.problem")}
        role="img"
        aria-label={t("flag.problem")}
        data-testid="match-sync-flag"
        data-state="problem"
        className="inline-flex"
      >
        <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
      </span>
    );
  }
  if (summary.pending > 0) {
    return (
      <span
        title={t("flag.pending")}
        role="img"
        aria-label={t("flag.pending")}
        data-testid="match-sync-flag"
        data-state="pending"
        className="inline-flex"
      >
        <CloudUpload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </span>
    );
  }
  return null;
}
