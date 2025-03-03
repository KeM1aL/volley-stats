"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Player } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { PlayerForm } from "./player-form";
import { update } from "rxdb/plugins/update";

type EditPlayerDialogProps = {
  player: Player | null;
  onClose: () => void;
  onPlayerUpdated: (player: Player) => void;
};

export function EditPlayerDialog({
  player,
  onClose,
  onPlayerUpdated,
}: EditPlayerDialogProps) {
  const { localDb: db } = useLocalDb();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (values: any) => {
    if (!player) return;

    setIsSubmitting(true);
    try {
      // const { data, error } = await supabase
      //   .from("players")
      //   .update({
      //     name: values.name,
      //     number: values.number,
      //     position: values.position,
      //   })
      //   .eq("id", player.id)
      //   .select()
      //   .single();

      // if (error) throw error;

      await db?.players.findOne(player.id).update({
        $set: {
          name: values.name,
          number: values.number,
          role: values.position,
          avatar_url: values.avatar_url,
          updated_at: new Date().toISOString(),
        },
      });

      onPlayerUpdated(player);

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