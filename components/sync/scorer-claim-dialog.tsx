"use client";

import { useTranslations } from "next-intl";
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
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

export type ClaimPrompt = { kind: "taken"; holder: ScorerInfo } | { kind: "offline" };

/** Asks before scoring a match another device holds, or one whose holder can't be checked offline. */
export function ScorerClaimDialog({
  prompt,
  busy,
  onCancel,
  onConfirm,
}: {
  prompt: ClaimPrompt | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("sync");
  if (!prompt) return null;
  const taken = prompt.kind === "taken";
  return (
    <AlertDialog open>
      <AlertDialogContent data-testid="scorer-claim-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{taken ? t("claim.takenTitle") : t("claim.offlineTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {taken
              ? t("claim.takenBody", {
                  name: prompt.holder.name ?? t("badge.unknownScorer"),
                  device: prompt.holder.deviceLabel ?? "—",
                  time: formatTime(prompt.holder.lastActivityAt) ?? t("claim.never"),
                })
              : t("claim.offlineBody")}
          </AlertDialogDescription>
          {taken && <p className="text-sm text-muted-foreground">{t("claim.takenWarning")}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={busy}>
            {t("claim.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {taken ? t("claim.takeOver") : t("claim.offlineConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
