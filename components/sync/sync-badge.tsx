"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CloudOff, LoaderCircle, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import type { SyncBadgeState } from "@/lib/rxdb/sync/status";
import { formatTime } from "./format";
import { SyncReason } from "./sync-reason";
import { useMatchLabels } from "./use-match-labels";

const ICONS: Record<SyncBadgeState, typeof Check> = {
  saved: Check,
  uploading: LoaderCircle,
  waiting: CloudOff,
  problem: TriangleAlert,
  "other-account": UserX,
};

function SupersededLine({ holder }: { holder: ScorerInfo | null }) {
  const t = useTranslations("sync");
  return (
    <p className="text-muted-foreground">
      {t("badge.superseded", {
        name: holder?.name ?? t("badge.unknownScorer"),
        time: formatTime(holder?.claimedAt) ?? "—",
      })}
    </p>
  );
}

/**
 * Whether this device's match data is on the server (spec section 8).
 * `compact` (live match header) shows the icon only and never toasts.
 */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("sync");
  const { toast } = useToast();
  const { localDb } = useLocalDb();
  const status = useSyncStatus();
  const [showSavedLabel, setShowSavedLabel] = useState(false);
  const previousState = useRef<SyncBadgeState | null>(null);
  const sawWaiting = useRef(false);
  const state = status?.state ?? null;

  useEffect(() => {
    if (!state) return;
    if (state === "waiting") sawWaiting.current = true;
    const previous = previousState.current;
    previousState.current = state;
    if (state !== "saved" || !previous || previous === "saved") return;
    if (sawWaiting.current && !compact) {
      sawWaiting.current = false;
      toast({ title: t("badge.allSavedToast") });
    }
    setShowSavedLabel(true);
    const timer = setTimeout(() => setShowSavedLabel(false), 3000);
    return () => clearTimeout(timer);
  }, [state, compact, t, toast]);

  const labels = useMatchLabels(status?.matches.map((match) => match.matchId) ?? []);
  if (!status || !localDb) return null;

  const Icon = ICONS[status.state];
  const label = {
    saved: t("badge.saved"),
    uploading: t("badge.uploading", { count: status.pendingCount }),
    waiting: t("badge.waiting", { count: status.pendingCount }),
    problem: t("badge.problem", { count: status.rejectedCount }),
    "other-account": t("badge.otherAccount"),
  }[status.state];
  const showLabel = !compact && (status.state !== "saved" || showSavedLabel);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="sync-badge"
          data-state={status.state}
          aria-label={label}
          className={cn(
            "gap-1.5 px-2 text-xs",
            status.state === "problem" && "text-destructive",
            status.state === "other-account" && "text-amber-600",
            status.state === "waiting" && "text-muted-foreground"
          )}
        >
          <Icon className={cn("h-4 w-4", status.state === "uploading" && "animate-spin")} />
          {showLabel && <span className="hidden sm:inline max-w-56 truncate">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3" data-testid="sync-details">
        <p className="text-sm font-medium">{label}</p>
        {status.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("badge.noIssues")}</p>
        ) : (
          <ul className="space-y-2">
            {status.matches.map((match) => (
              <li key={match.matchId} className="space-y-1 text-sm">
                <p className="truncate font-medium">{labels.get(match.matchId) ?? match.matchId}</p>
                {(match.pending > 0 || match.rejected > 0) && (
                  <p className="text-muted-foreground">
                    {t("badge.matchLine", { pending: match.pending, rejected: match.rejected })}
                  </p>
                )}
                {match.reasons.map((reason) => (
                  <SyncReason key={`${reason.code}:${JSON.stringify(reason.params)}`} reason={reason} />
                ))}
                {match.superseded > 0 && <SupersededLine holder={match.lostTo} />}
              </li>
            ))}
          </ul>
        )}
        {status.rejectedCount > 0 && (
          <Button size="sm" className="w-full" onClick={() => void localDb.syncManager.retryRejected()}>
            {t("badge.retry")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
