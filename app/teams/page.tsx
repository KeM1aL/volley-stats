'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
  const router = useRouter();
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const teamApi = useTeamApi();
  const isInitialMount = useRef(true);

  // Placeholder for user permissions
  const canManage = (team: Team) => {
    // Replace with actual permission check
    return true;
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
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teams</h1>
        <Button onClick={() => setNewTeam(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
      </div>

      <TeamFilters onFilterChange={handleFilterChange} initialFilters={initialFilters} />
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
