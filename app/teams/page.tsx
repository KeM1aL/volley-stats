'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Filter as FilterIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamTable } from "@/components/teams/team-table";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { useTeamApi } from "@/hooks/use-team-api";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Team, User } from "@/lib/types";
import { Filter, Sort } from "@/lib/api/types";
import { TeamFilters } from "@/components/teams/team-filters";
import { NewTeamDialog } from "@/components/teams/new-team-dialog";
import { useTranslations } from "next-intl";
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
import { useToast } from "@/hooks/use-toast";

export default function TeamsPage() {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const { user, reloadUser } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [archivingTeam, setArchivingTeam] = useState<Team | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const teamApi = useTeamApi();
  const isInitialMount = useRef(true);

  // Placeholder for user permissions
  const canManage = (team: Team) => {
    // Replace with actual permission check
    if (!user || !user.teamMembers) return false;
    if(user.id === team.user_id) return true; // Owners can manage
    return user?.teamMembers?.some((tm) => tm.team_id === team.id && (tm.user_id === user.id || tm.role === 'owner' || tm.role === 'coach')) || false;
  };

  // Prepare initial filters from favorites
  const initialFilters = useMemo(() => {
  
    return {
      status: 'active',
      user_id: user?.id,
    };
  }, [user]);

  useEffect(() => {
    const loadTeams = async () => {
      // Don't load if no favorite and no filters set
      const hasFilters = filters.length > 0;

      if (!hasFilters) {
        setTeams([]);
        setIsLoading(false);
        return;
      }

      // On initial mount, wait for filters to be applied if we have favorites
      // This prevents loading all teams before initialFilters are applied
      if (isInitialMount.current && !hasFilters) {
        isInitialMount.current = false;
        return; // Keep loading state, will load when filters arrive
      }

      isInitialMount.current = false;

      // Load teams with current filters
      setIsLoading(true);
      try {
        const sort: Sort<Team>[] = [{ field: 'name', direction: 'asc' }];
        const data = await teamApi.getTeams(filters, sort, ['championships', 'clubs']);
        setTeams(data);
      } catch (error) {
        console.error("Failed to load teams from api:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [filters, teamApi, refreshKey]);

  const handleFilterChange = useCallback((newFilters: Filter[]) => {
    setFilters(newFilters);
  }, []);

  const handleTeamRefresh = useCallback(() => {
    if(user && (!user.teamMembers || user.teamMembers.length === 0)) {
      reloadUser();
    }
    setRefreshKey((prev) => prev + 1);
  }, [editingTeam]);

  const handleArchive = async () => {
    if (!archivingTeam) return;
    setIsArchiving(true);
    try {
      await teamApi.archiveTeam(archivingTeam.id);
      toast({ title: t('toast.archived'), description: t('toast.archivedDesc', { name: archivingTeam.name }) });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to archive team:", error);
      toast({ variant: "destructive", title: t('toast.error'), description: t('toast.archiveError') });
    } finally {
      setIsArchiving(false);
      setArchivingTeam(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <FilterIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('filters.title')}</span>
          </Button>
          <Button onClick={() => setNewTeam(true)} className="flex-1 sm:flex-none text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('newTeam')}</span>
          </Button>
        </div>
      </div>

      {/* Always render TeamFilters to apply initial filters, but hide when collapsed */}
      <div className={showFilters ? "" : "hidden"}>
        <TeamFilters onFilterChange={handleFilterChange} initialFilters={initialFilters} />
      </div>
      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <TeamTable teams={teams} onEdit={setEditingTeam} onArchive={setArchivingTeam} canManage={canManage} />
      )}

      <EditTeamDialog
        team={editingTeam}
        onClose={() => setEditingTeam(null)}
        onSuccess={handleTeamRefresh}
      />

      <NewTeamDialog
        open={newTeam}
        onClose={() => setNewTeam(false)}
        onSuccess={handleTeamRefresh}
      />

      <AlertDialog open={!!archivingTeam} onOpenChange={(open) => !open && setArchivingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive.confirmTitle', { name: archivingTeam?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('archive.confirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {t('archive.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
