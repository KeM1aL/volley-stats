"use client";

import type { Match } from "@/lib/supabase/types";
import { MatchLineupSetup } from "@/components/matches/match-lineup-setup";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@radix-ui/react-dialog";
import { DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Volleyball } from "lucide-react";

type MatchStartDialogProps = {
  match: Match;
};

export default function MatchEditDialog({ match }: MatchStartDialogProps) {
  function onSetupComplete(): void {
    throw new Error("Function not implemented.");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Managing Team</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <MatchLineupSetup match={match} onComplete={onSetupComplete} />
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
