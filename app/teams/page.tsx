'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Filter as FilterIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamTable } from "@/components/teams/team-table";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { useTeamApi } from "@/hooks/use-team-api";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Team } from "@/lib/types";
import { Filter, Sort } from "@/lib/api/types";
import { TeamFilters } from "@/components/teams/team-filters";
import { NewTeamDialog } from "@/components/teams/new-team-dialog";

export default function TeamsPage() {
  const { user, reloadUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const teamApi = useTeamApi();
  const isInitialMount = useRef(true);

  // Placeholder for user permissions
  const canManage = (team: Team) => {
    // Replace with actual permission check
    return user?.teamMembers?.some((tm => tm.team_id === team.id && (tm.user_id === user.id || tm.role === 'owner' || tm.role === 'coach'))) || false;
  };

  // Prepare initial filters from favorites
  const initialFilters = useMemo(() => {
    if (!user) return undefined;

    if (user.profile.favorite_club) {
      return { selectedClub: user.profile.favorite_club };
    } else if (user.profile.favorite_team) {
      // If favorite team is set, search by team name
      return { searchTerm: user.profile.favorite_team.name };
    }

    return undefined;
  }, [user]);

  useEffect(() => {
    const loadTeams = async () => {
      // Don't load if no favorite and no filters set
      const hasFavorite = user?.profile.favorite_team_id || user?.profile.favorite_club_id;
      const hasFilters = filters.length > 0;

      if (!hasFavorite && !hasFilters) {
        setTeams([]);
        setIsLoading(false);
        return;
      }

      // On initial mount, wait for filters to be applied if we have favorites
      // This prevents loading all teams before initialFilters are applied
      if (isInitialMount.current && hasFavorite && !hasFilters) {
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
  }, [filters, teamApi, user, refreshKey]);

  const handleFilterChange = useCallback((newFilters: Filter[]) => {
    setFilters(newFilters);
  }, []);

  const handleTeamRefresh = useCallback(() => {
    if(user && (!user.teamMembers || user.teamMembers.length === 0)) {
      reloadUser();
    }
    setRefreshKey((prev) => prev + 1);
  }, [editingTeam]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Teams</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
            View and manage your teams
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <FilterIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span>Filters</span>
          </Button>
          <Button onClick={() => setNewTeam(true)} className="flex-1 sm:flex-none text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span>New Team</span>
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
        <TeamTable teams={teams} onEdit={setEditingTeam} canManage={canManage} />
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
    </div>
  );
}
