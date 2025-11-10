"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewMatchForm } from "./new-match-form";

type NewMatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (matchId: string) => void;
};

export function NewMatchDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewMatchDialogProps) {
  const handleMatchCreated = (matchId: string) => {
    onOpenChange(false);
    if (onSuccess) {
      onSuccess(matchId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Match</DialogTitle>
        </DialogHeader>
        <NewMatchForm
          onMatchCreated={handleMatchCreated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
