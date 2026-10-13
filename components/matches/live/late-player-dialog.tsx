"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { latePlayerCandidates } from "@/lib/matches/late-players";
import type { TeamMember } from "@/lib/types";

type LatePlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  /** Players already in the match's roster. */
  rosterIds: string[];
  onAdd: (player: TeamMember) => Promise<void>;
};

/** Picks a team member who isn't in the match's roster yet. Reads the local database, so it works offline. */
export function LatePlayerDialog({ open, onOpenChange, teamId, rosterIds, onAdd }: LatePlayerDialogProps) {
  const t = useTranslations("matches");
  const { localDb } = useLocalDb();
  const [candidates, setCandidates] = useState<TeamMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The roster as a string, so a new array with the same ids doesn't reload the list.
  const rosterKey = rosterIds.join(",");

  useEffect(() => {
    if (!open || !localDb) return;
    let cancelled = false;
    localDb.team_members
      .find({ selector: { team_id: teamId } })
      .exec()
      .then((docs) => {
        if (cancelled) return;
        const members = docs.map((doc) => doc.toJSON() as TeamMember);
        setCandidates(latePlayerCandidates(members, rosterKey ? rosterKey.split(",") : []));
      })
      .catch((error) => {
        console.error("Failed to load the team members:", error);
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
      setCandidates(null); // back to the spinner for the next load
    };
  }, [open, localDb, teamId, rosterKey]);

  const add = async (player: TeamMember) => {
    setBusy(true);
    try {
      await onAdd(player);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="late-player-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("live.latePlayer.title")}</DialogTitle>
          <DialogDescription>{t("live.latePlayer.description")}</DialogDescription>
        </DialogHeader>
        {candidates === null ? (
          <div className="flex justify-center py-6" role="status" aria-busy="true">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("live.latePlayer.none")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((player) => (
              <Button
                key={player.id}
                variant="outline"
                disabled={busy}
                data-testid="late-player-option"
                data-player-name={player.name}
                onClick={() => void add(player)}
              >
                #{player.number} {player.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
