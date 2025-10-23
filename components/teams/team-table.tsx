'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Users } from "lucide-react";
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
import { Team } from "@/lib/types";
import { useTeamApi } from "@/hooks/use-team-api";

type TeamTableProps = {
  teams: Team[];
  onEdit: (team: Team) => void;
  canManage: (team: Team) => boolean;
};

export function TeamTable({ teams, onEdit, canManage }: TeamTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const teamApi = useTeamApi();
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingTeam) return;

    setIsDeleting(true);
    try {
      await teamApi.deleteTeam(deletingTeam.id);

      toast({
        title: "Team deleted",
        description: "The team has been successfully deleted.",
      });

      router.refresh();
    } catch (error) {
      console.error("Failed to delete team:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete team. Please try again.",
      });
    } finally {
      setIsDeleting(false);
      setDeletingTeam(null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team Name</TableHead>
            <TableHead>Championship</TableHead>
            <TableHead>Club</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell className="font-medium">{team.name}</TableCell>
              <TableCell>{team.championships?.name}</TableCell>
              <TableCell>{team.clubs?.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/teams/${team.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  {canManage(team) && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/teams/${team.id}/players`)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(team)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingTeam(team)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deletingTeam} onOpenChange={() => setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team
              and all associated data.
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
