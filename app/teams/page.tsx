"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamTable } from "@/components/teams/team-table";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Team } from "@/lib/types";

export default function TeamsPage() {
  const router = useRouter();
  const { localDb: db } = useLocalDb();
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("teams").select("*").order("name", { ascending: true });;
      if (error) throw error;
      setTeams(data);
      setIsLoading(false);
    };

    loadTeams();
  }, [db]);

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