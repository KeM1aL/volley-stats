"use client";

import type { Match, Team } from "@/lib/supabase/types";
import { MatchLineupSetup } from "@/components/matches/match-lineup-setup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart2, Pencil, Volleyball } from "lucide-react";
import { MatchManagedTeamSetup } from "./match-managed-setup";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocalDb } from "../providers/local-database-provider";
import { toast } from "@/hooks/use-toast";

type MatchStatsDialogProps = {
  match: Match;
};

export default function MatchEditDialog({ match }: MatchStatsDialogProps) {
  const { localDb: db } = useLocalDb();
  const router = useRouter();
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTeams = async () => {
      if (!db) return;
      setIsLoading(true);
      try {
        const teamDocs = await db.teams
          .findByIds([match.home_team_id, match.away_team_id])
          .exec();

        if (!teamDocs || teamDocs.size !== 2) {
          throw new Error("Teams not found");
        }

        const teams = Array.from(teamDocs.values());
        setHomeTeam(teams[0].toJSON());
        setAwayTeam(teams[1].toJSON());
      } catch (error) {
        console.error("Failed to load teams:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load teams",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [db, match.id]);

  async function onManagedTeamSelected(teamId: string): Promise<void> {
    let selectedTeamId;
    if (teamId === match.away_team_id) {
      selectedTeamId = match.away_team_id;
    } else {
      selectedTeamId = match.home_team_id;
    }
    const params = new URLSearchParams();
    params.set("team", selectedTeamId);

    router.push(`/stats/${match.id}?${params.toString()}`);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <BarChart2 className="h-4 w-4 mr-2" />
          Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Managing Team</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <MatchManagedTeamSetup
            homeTeam={homeTeam!}
            awayTeam={awayTeam!}
            onTeamSelected={onManagedTeamSelected}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
