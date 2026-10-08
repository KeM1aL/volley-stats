"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

/** Shown instead of the scoring controls once another device took the match over. */
export function TakenOverBanner({ holder }: { holder: ScorerInfo | null }) {
  const t = useTranslations("sync");
  return (
    <Alert data-testid="taken-over-banner" className="m-2 w-auto">
      <AlertDescription>
        {t("claim.takenOverBanner", {
          name: holder?.name ?? t("badge.unknownScorer"),
          device: holder?.deviceLabel ?? "—",
          time: formatTime(holder?.claimedAt) ?? "—",
        })}
      </AlertDescription>
    </Alert>
  );
}
