"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerTable } from "@/components/players/player-table";
import { EditPlayerDialog } from "@/components/players/edit-player-dialog";
import { NewPlayerDialog } from "@/components/players/new-player-dialog";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamMember, Team } from "@/lib/types";

export default function PlayersPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<TeamMember | null>(null);
  const [isNewPlayerOpen, setIsNewPlayerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const teamId = params.id as string;

    const [teamResponse, playersResponse] = await Promise.all([
      supabase.from("teams").select("*").eq("id", teamId).single(),
      supabase.from("team_members").select("*").eq("team_id", teamId),
    ]);

    if (teamResponse.error) throw teamResponse.error;
    if (playersResponse.error) throw playersResponse.error;

    setTeam(teamResponse.data);
    setPlayers(playersResponse.data);
    setIsLoading(false);
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <p className="text-muted-foreground">Manage team players</p>
        </div>
        <Button onClick={() => setIsNewPlayerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Player
        </Button>
      </div>

      <PlayerTable
        players={players}
        onEdit={setEditingPlayer}
        onPlayersChange={setPlayers}
      />

      <EditPlayerDialog
        player={editingPlayer}
        onClose={() => setEditingPlayer(null)}
        onPlayerUpdated={() => loadData()}
      />

      <NewPlayerDialog
        teamId={team.id}
        open={isNewPlayerOpen}
        onClose={() => setIsNewPlayerOpen(false)}
        onPlayerCreated={() => loadData()}
      />
    </div>
  );
}