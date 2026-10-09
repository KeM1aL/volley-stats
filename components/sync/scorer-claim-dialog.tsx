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

export type ClaimPrompt = { kind: "taken"; holder: ScorerInfo } | { kind: "offline" } | { kind: "forbidden" };

/**
 * Asks before scoring a match another device holds, or one whose holder can't be checked offline.
 * `forbidden`: the server refused the claim (this user can't write the match); the only way out is back.
 */
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
  const tCommon = useTranslations("common");
  if (!prompt) return null;
  if (prompt.kind === "forbidden") {
    return (
      <AlertDialog open>
        <AlertDialogContent data-testid="scorer-claim-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("claim.forbiddenTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("claim.forbiddenBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onCancel}>{tCommon("actions.back")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
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
