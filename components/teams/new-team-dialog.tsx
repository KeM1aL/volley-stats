'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamForm } from "./team-form";

type NewTeamDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (id: string) => void;
};

export function NewTeamDialog({ open, onClose, onSuccess }: NewTeamDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Team</DialogTitle>
        </DialogHeader>
        <TeamForm onClose={onClose} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}
