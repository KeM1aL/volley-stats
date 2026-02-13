"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TeamMember } from "@/lib/types";
import { supabase } from "@/lib/supabase/client";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { deleteAvatar } from "@/lib/supabase/storage";
import { useTranslations } from "next-intl";
import { useTeamMembersApi } from "@/hooks/use-team-members-api";

type PlayerTableProps = {
  players: TeamMember[];
  onEdit: (player: TeamMember) => void;
  onPlayersChange: (players: TeamMember[]) => void;
};

export function PlayerTable({ players, onEdit, onPlayersChange }: PlayerTableProps) {
  const t = useTranslations('players');
  const tc = useTranslations('common');
  const te = useTranslations("enums");
  const teamMemberApi = useTeamMembersApi();
  const { toast } = useToast();
  const [deletePlayer, setDeletePlayer] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletePlayer) return;

    setIsDeleting(true);
    try {
      if (deletePlayer.avatar_url) {
        await deleteAvatar(deletePlayer.id);
      }

      // const { error } = await supabase
      //   .from("players")
      //   .delete()
      //   .eq("id", deletePlayer.id);

      // if (error) throw error;

      await teamMemberApi.deleteTeamMember(deletePlayer.id);

      onPlayersChange(players.filter(p => p.id !== deletePlayer.id));

      toast({
        title: t('toast.deleted'),
        description: t('toast.deletedDesc'),
      });
    } catch (error) {
      console.error("Failed to delete player:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: t('toast.deleteError'),
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
            <TableHead>{t('table.avatar')}</TableHead>
            <TableHead>#</TableHead>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.position')}</TableHead>
            <TableHead>{t('table.role')}</TableHead>
            <TableHead className="w-[100px]">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell>
                <Avatar>
                  {player.avatar_url ? (
                    <AvatarImage src={player.avatar_url} alt={player.name} />
                  ) : (
                    <AvatarFallback>
                      {player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              </TableCell>
              <TableCell>{player.number}</TableCell>
              <TableCell className="font-medium">{player.name}</TableCell>
              <TableCell>{te(`playerRole.${player.position}`)}</TableCell>
              <TableCell className="capitalize">{te(`teamMemberRole.${player.role}`)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(player)}
                    aria-label={`Edit ${player.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletePlayer(player)}
                    aria-label={`Delete ${player.name}`}
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
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}