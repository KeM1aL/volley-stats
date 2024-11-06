"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Player } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";
import { useDb } from "@/components/providers/database-provider";
import { PlayerForm } from "./player-form";

type NewPlayerDialogProps = {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onPlayerCreated: (player: Player) => void;
};

export function NewPlayerDialog({
  teamId,
  open,
  onClose,
  onPlayerCreated,
}: NewPlayerDialogProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      const player = {
        id: crypto.randomUUID(),
        team_id: teamId,
        name: values.name,
        number: values.number,
        position: values.position,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Player;

      // const { data, error } = await supabase
      //   .from("players")
      //   .insert(player)
      //   .select()
      //   .single();

      // if (error) throw error;

      await db?.players.insert(player);

      onPlayerCreated(player);

      toast({
        title: "Player created",
        description: "The player has been successfully created.",
      });

      onClose();
    } catch (error) {
      console.error("Failed to create player:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create player. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Player</DialogTitle>
        </DialogHeader>
        <PlayerForm
          onSubmit={onSubmit}
          submitLabel="Create Player"
          isSubmitting={isSubmitting}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}