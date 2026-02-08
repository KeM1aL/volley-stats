'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Team } from "@/lib/types";
import { TeamForm } from "./team-form";
import { useTranslations } from "next-intl";

type EditTeamDialogProps = {
  team: Team | null;
  onClose: () => void;
  onSuccess?: (id: string) => void;
};

export function EditTeamDialog({ team, onClose, onSuccess }: EditTeamDialogProps) {
  const t = useTranslations('teams');

  return (
    <Dialog open={!!team} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('details.editTeam')}</DialogTitle>
        </DialogHeader>
        <TeamForm team={team} onClose={onClose} onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}
