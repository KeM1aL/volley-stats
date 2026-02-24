"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { TeamMember } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { PlayerForm } from "./player-form";
import { update } from "rxdb/plugins/update";
import { useTeamMembersApi } from "@/hooks/use-team-members-api";
import { useTranslations } from "next-intl";

type EditPlayerDialogProps = {
  player: TeamMember | null;
  onClose: () => void;
  onPlayerUpdated: (player: TeamMember) => void;
};

export function EditPlayerDialog({
  player,
  onClose,
  onPlayerUpdated,
}: EditPlayerDialogProps) {
  const t = useTranslations('players');
  const { toast } = useToast();
  const teamMemberApi = useTeamMembersApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (values: any) => {
    if (!player) return;

    setIsSubmitting(true);
    try {
      const playerUpdated = {
        name: values.name,
        number: values.number,
        avatar_url: values.avatar_url,
        role: values.role,
        position: values.position,
        updated_at: new Date().toISOString(),
      } as TeamMember;

      await teamMemberApi.updateTeamMember(player.id, playerUpdated);

      onPlayerUpdated(playerUpdated);

      toast({
        title: t('toast.updated'),
        description: t('toast.updatedDesc'),
      });

      onClose();
    } catch (error) {
      console.error("Failed to update player:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: t('toast.updateError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!player} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialog.editPlayer')}</DialogTitle>
        </DialogHeader>
        <PlayerForm
          defaultValues={player || undefined}
          onSubmit={onSubmit}
          submitLabel={t('form.saveChanges')}
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}