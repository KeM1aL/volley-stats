"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

/**
 * Shown instead of the scoring controls once another device took the match over. Scoring can be
 * taken back after a confirmation: this device's changes superseded by the takeover are discarded.
 */
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
  const [confirming, setConfirming] = useState(false);
  const name = holder?.name ?? t("badge.unknownScorer");
  return (
    <Alert data-testid="taken-over-banner" className="m-2 w-auto">
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          {t("claim.takenOverBanner", {
            name,
            device: holder?.deviceLabel ?? "—",
            time: formatTime(holder?.claimedAt) ?? "—",
          })}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming(true)}
          data-testid="take-back-scoring"
        >
          {t("claim.takeOver")}
        </Button>
      </AlertDescription>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent data-testid="take-back-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("claim.takeBackTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("claim.takeBackBody", { name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("claim.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                onTakeBack();
              }}
            >
              {t("claim.takeBackConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Alert>
  );
}
