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
        title: "Player updated",
        description: "The player has been successfully updated.",
      });

      onClose();
    } catch (error) {
      console.error("Failed to update player:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update player. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!player} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Player</DialogTitle>
        </DialogHeader>
        <PlayerForm
          defaultValues={player || undefined}
          onSubmit={onSubmit}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}