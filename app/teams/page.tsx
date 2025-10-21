'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamTable } from "@/components/teams/team-table";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { useTeamApi } from "@/hooks/use-team-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Team } from "@/lib/types";
import { Sort } from "@/lib/api/types";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const teamApi = useTeamApi();

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const sort: Sort<Team>[] = [{ field: 'name', direction: 'asc' }];
        const data = await teamApi.getTeams(undefined, sort);
        setTeams(data);
      } catch (error) {
        console.error("Failed to load teams:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [teamApi]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teams</h1>
        <Button onClick={() => router.push("/teams/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Team
        </Button>
      </div>

      <TeamTable teams={teams} onEdit={setEditingTeam} />

      <EditTeamDialog
        team={editingTeam}
        onClose={() => setEditingTeam(null)}
      />
    </div>
  );
}
