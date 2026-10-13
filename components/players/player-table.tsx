"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TeamMember } from "@/lib/types";
import { useTranslations } from "next-intl";
import { useTeamMembersApi } from "@/hooks/use-team-members-api";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type PlayerTableProps = {
  players: TeamMember[];
  onEdit: (player: TeamMember) => void;
  onPlayersChange: (players: TeamMember[]) => void;
};

/**
 * Members of a team. Members are archived, never deleted: past matches reference them. Archived members
 * are listed on demand and can be restored. Nobody can archive their own membership.
 */
export function PlayerTable({ players, onEdit, onPlayersChange }: PlayerTableProps) {
  const t = useTranslations("players");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const teamMemberApi = useTeamMembersApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const [archivePlayer, setArchivePlayer] = useState<TeamMember | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activePlayers = players.filter((player) => !player.archived_at);
  const archivedPlayers = players.filter((player) => !!player.archived_at);

  const setArchivedAt = async (player: TeamMember, archivedAt: string | null) => {
    const updated = await teamMemberApi.updateTeamMember(player.id, { archived_at: archivedAt });
    onPlayersChange(players.map((p) => (p.id === player.id ? { ...p, ...updated } : p)));
  };

  const handleArchive = async () => {
    if (!archivePlayer) return;
    setIsSaving(true);
    try {
      await setArchivedAt(archivePlayer, new Date().toISOString());
      toast({ title: t("toast.archived"), description: t("toast.archivedDesc", { name: archivePlayer.name }) });
    } catch (error) {
      console.error("Failed to archive player:", error);
      toast({ variant: "destructive", title: t("toast.error"), description: t("toast.archiveError") });
    } finally {
      setIsSaving(false);
      setArchivePlayer(null);
    }
  };

  const handleRestore = async (player: TeamMember) => {
    setIsSaving(true);
    try {
      await setArchivedAt(player, null);
      toast({ title: t("toast.restored"), description: t("toast.restoredDesc", { name: player.name }) });
    } catch (error) {
      console.error("Failed to restore player:", error);
      toast({ variant: "destructive", title: t("toast.error"), description: t("toast.restoreError") });
    } finally {
      setIsSaving(false);
    }
  };

  const isOwnMembership = (player: TeamMember) => !!player.user_id && player.user_id === user?.id;

  const renderRow = (player: TeamMember, archived: boolean) => (
    <TableRow
      key={player.id}
      data-testid={archived ? "archived-player-row" : "player-row"}
      className={cn(archived && "opacity-60")}
    >
      <TableCell>
        <Avatar>
          {player.avatar_url ? (
            <AvatarImage src={player.avatar_url} alt={player.name} />
          ) : (
            <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          )}
        </Avatar>
      </TableCell>
      <TableCell>{player.number}</TableCell>
      <TableCell className="font-medium">
        {player.name}
        {archived && (
          <Badge variant="outline" className="ml-2">
            {t("archive.badge")}
          </Badge>
        )}
      </TableCell>
      <TableCell>{player.position ? te(`playerRole.${player.position}`) : ""}</TableCell>
      <TableCell className="capitalize">{te(`teamMemberRole.${player.role}`)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {archived ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => void handleRestore(player)}
              aria-label={t("archive.restoreAriaLabel", { name: player.name })}
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEdit(player)} aria-label={`Edit ${player.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              {!isOwnMembership(player) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setArchivePlayer(player)}
                  aria-label={t("archive.ariaLabel", { name: player.name })}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.avatar")}</TableHead>
            <TableHead>#</TableHead>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead>{t("table.position")}</TableHead>
            <TableHead>{t("table.role")}</TableHead>
            <TableHead className="w-[100px]">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activePlayers.map((player) => renderRow(player, false))}
          {showArchived && archivedPlayers.map((player) => renderRow(player, true))}
        </TableBody>
      </Table>

      {archivedPlayers.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t("archive.hideArchived") : t("archive.showArchived", { count: archivedPlayers.length })}
        </Button>
      )}

      <AlertDialog open={!!archivePlayer} onOpenChange={(open) => !open && setArchivePlayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archive.confirmTitle", { name: archivePlayer?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("archive.confirmDesc")}
              {archivePlayer?.user_id && <> {t("archive.loseAccess")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()} disabled={isSaving}>
              {t("archive.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
