'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamForm } from "./team-form";
import { useTranslations } from "next-intl";

type NewTeamDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (id: string) => void;
};

export function NewTeamDialog({ open, onClose, onSuccess }: NewTeamDialogProps) {
  const t = useTranslations('teams');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newTeam')}</DialogTitle>
        </DialogHeader>
        <TeamForm onClose={onClose} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}
