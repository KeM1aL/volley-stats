"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Player } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";
import { useDb } from "@/components/providers/database-provider";

type PlayerTableProps = {
  players: Player[];
  onEdit: (player: Player) => void;
  onPlayersChange: (players: Player[]) => void;
};

export function PlayerTable({ players, onEdit, onPlayersChange }: PlayerTableProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletePlayer) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("players")
        .delete()
        .eq("id", deletePlayer.id);

      if (error) throw error;

      await db?.players.findOne(deletePlayer.id).remove();

      onPlayersChange(players.filter(p => p.id !== deletePlayer.id));

      toast({
        title: "Player deleted",
        description: "The player has been successfully deleted.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete player. Please try again.",
      });
    } finally {
      setIsDeleting(false);
      setDeletePlayer(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Position</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell>{player.number}</TableCell>
              <TableCell className="font-medium">{player.name}</TableCell>
              <TableCell>{player.position}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(player)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletePlayer(player)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deletePlayer} onOpenChange={() => setDeletePlayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the player
              and all associated statistics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}