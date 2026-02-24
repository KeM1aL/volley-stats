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
import { useTeamMembersApi } from "@/hooks/use-team-members-api";
import { useTranslations } from "next-intl";

type NewPlayerDialogProps = {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onPlayerCreated: (player: TeamMember) => void;
};

export function NewPlayerDialog({
  teamId,
  open,
  onClose,
  onPlayerCreated,
}: NewPlayerDialogProps) {
  const t = useTranslations('players');
  const { toast } = useToast();
  const teamMemberApi = useTeamMembersApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      const player = {
        id: crypto.randomUUID(),
        team_id: teamId,
        name: values.name,
        number: values.number,
        avatar_url: values.avatar_url,
        role: values.role,
        position: values.position,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TeamMember;

      await teamMemberApi.createTeamMember(player);

      onPlayerCreated(player);

      toast({
        title: t('toast.created'),
        description: t('toast.createdDesc'),
      });

      onClose();
    } catch (error) {
      console.error("Failed to create player:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: t('toast.createError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialog.newPlayer')}</DialogTitle>
        </DialogHeader>
        <PlayerForm
          onSubmit={onSubmit}
          submitLabel={t('form.createPlayer')}
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}