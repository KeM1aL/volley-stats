'use client';

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { Team, TeamStatus } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "next-intl";

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
  onDelete: (team: Team) => void;
  canManage: (team: Team) => boolean;
};

export function TeamTable({ teams, onEdit, onDelete, canManage }: TeamTableProps) {
  const t = useTranslations('teams');
  const router = useRouter();
  const { user } = useAuth();

  if (teams.length === 0) {
    const hasFavorite = user?.profile.favorite_team_id || user?.profile.favorite_club_id;

    return (
      <EmptyState
        icon={<Search className="h-12 w-12" />}
        title={t('empty.noTeams')}
        description={
          hasFavorite
            ? t('empty.noTeamsWithFilters')
            : t('empty.noTeamsNoFavorite')
        }
        action={
          !hasFavorite
            ? {
                label: t('empty.goToSettings'),
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
                {t(`status.${team.status}`)}
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
                <span className="text-xs">{t('table.view')}</span>
              </Button>
              {canManage(team) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/teams/${team.id}/players`)}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    <span className="text-xs">{t('table.players')}</span>
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
                    onClick={() => onDelete(team)}
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
              <TableHead>{t('table.teamName')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead>{t('table.championship')}</TableHead>
              <TableHead>{t('table.club')}</TableHead>
              <TableHead className="w-[100px]">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>
                  <Badge variant={getTeamStatusVariant(team.status)}>
                    {t(`status.${team.status}`)}
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
                          onClick={() => onDelete(team)}
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

    </>
  );
}
