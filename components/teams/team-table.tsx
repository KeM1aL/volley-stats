'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Users, Search } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Team, TeamStatus } from "@/lib/types";
import { useTeamApi } from "@/hooks/use-team-api";
import { EmptyState } from "@/components/ui/empty-state";

// Helper function to get badge variant based on team status
function getTeamStatusVariant(status: TeamStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case 'active':
      return 'default';  // Blue badge
    case 'incomplete':
      return 'secondary';  // Orange/warning badge
    case 'archived':
      return 'outline';  // Gray badge
    default:
      return 'outline';
  }
}

type TeamTableProps = {
  teams: Team[];
  onEdit: (team: Team) => void;
  canManage: (team: Team) => boolean;
};

export function TeamTable({ teams, onEdit, canManage }: TeamTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
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

  if (teams.length === 0) {
    const hasFavorite = user?.profile.favorite_team_id || user?.profile.favorite_club_id;

    return (
      <EmptyState
        icon={<Search className="h-12 w-12" />}
        title="No teams found"
        description={
          hasFavorite
            ? "No teams found with current filters. Try adjusting your search criteria."
            : "Set your favorite team or club in settings to see teams by default, or use the filters above to find teams."
        }
        action={
          !hasFavorite
            ? {
                label: "Go to Settings",
                href: "/settings"
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {teams.map((team) => (
          <div
            key={team.id}
            className="border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{team.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {team.clubs?.name}
                </p>
              </div>
              <Badge variant={getTeamStatusVariant(team.status)}>
                {team.status}
              </Badge>
            </div>
            {team.championships?.name && (
              <p className="text-sm text-muted-foreground truncate">
                {team.championships.name}
              </p>
            )}
            <div className="flex items-center gap-1 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/teams/${team.id}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                <span className="text-xs">View</span>
              </Button>
              {canManage(team) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/teams/${team.id}/players`)}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    <span className="text-xs">Players</span>
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
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block w-full overflow-x-auto">
        <div className="inline-block min-w-full">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Championship</TableHead>
              <TableHead>Club</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>
                  <Badge variant={getTeamStatusVariant(team.status)}>
                    {team.status}
                  </Badge>
                </TableCell>
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
        </div>
      </div>

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
