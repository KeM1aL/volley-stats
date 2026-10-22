"use client";

import { useState } from "react";
import { Archive, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useMatchApi } from "@/hooks/use-match-api";
import { useToast } from "@/hooks/use-toast";
import { useMatchUnsentCount } from "@/hooks/use-unsent-guard";
import { matchRemoval, removalError } from "@/lib/matches/removal";
import type { Match } from "@/lib/types";

type MatchRemovalActionProps = {
  match: Match;
  /** Called once the removal is over, whether it worked or failed: the list reloads the match's real state. */
  onDone: () => void;
};

/**
 * Delete (a match that never started) or archive (any other) button with its confirmation. Neither goes
 * through while this device still has changes to the match to upload.
 */
export function MatchRemovalAction({ match, onDone }: MatchRemovalActionProps) {
  const t = useTranslations("matches");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const matchApi = useMatchApi();
  const { localDb } = useLocalDb();
  const unsent = useMatchUnsentCount(match.id, ["pending", "rejected"]);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Set when a delete is refused because the match started elsewhere: the row offers Archive from then on.
  const [startedElsewhere, setStartedElsewhere] = useState(false);

  const removal = startedElsewhere ? "archive" : matchRemoval(match);
  const names = {
    home: match.home_team?.name ?? t("table.unknown"),
    away: match.away_team?.name ?? t("table.unknown"),
  };
  const Icon = removal === "delete" ? Trash2 : Archive;

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      if (removal === "delete") {
        await matchApi.deleteUnstartedMatch(match.id);
        // Best effort: the local copy of a match that no longer exists must not keep syncing.
        await localDb?.syncManager.forgetMatch(match.id).catch(() => {});
        toast({ title: t("removal.toast.deleted") });
      } else {
        await matchApi.archiveMatch(match.id);
        toast({ title: t("removal.toast.archived"), description: t("removal.toast.archivedDesc") });
      }
    } catch (error) {
      console.error("Failed to remove match:", error);
      const reason = removalError(error);
      if (reason === "started") setStartedElsewhere(true);
      toast({
        variant: "destructive",
        title: t("toast.error"),
        description: t(`removal.errors.${reason}`),
      });
    } finally {
      setIsSaving(false);
      setOpen(false);
      onDone();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t(removal === "delete" ? "removal.deleteAriaLabel" : "removal.archiveAriaLabel", names)}
      >
        <Icon className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(removal === "delete" ? "removal.deleteTitle" : "removal.archiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {removal === "delete"
                ? t("removal.deleteDesc", { ...names, date: new Date(match.date).toLocaleDateString() })
                : t("removal.archiveDesc", names)}
              {unsent > 0 && <> {t("removal.unsent")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
              disabled={isSaving || unsent > 0}
            >
              {t(removal === "delete" ? "removal.deleteAction" : "removal.archiveAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
