"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

/** Shown instead of the scoring controls once another device took the match over; scoring can be taken back. */
export function TakenOverBanner({
  holder,
  busy,
  onTakeBack,
}: {
  holder: ScorerInfo | null;
  busy: boolean;
  onTakeBack: () => void;
}) {
  const t = useTranslations("sync");
  return (
    <Alert data-testid="taken-over-banner" className="m-2 w-auto">
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          {t("claim.takenOverBanner", {
            name: holder?.name ?? t("badge.unknownScorer"),
            device: holder?.deviceLabel ?? "—",
            time: formatTime(holder?.claimedAt) ?? "—",
          })}
        </span>
        <Button size="sm" variant="outline" disabled={busy} onClick={onTakeBack} data-testid="take-back-scoring">
          {t("claim.takeOver")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
