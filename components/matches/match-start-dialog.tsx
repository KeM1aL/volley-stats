"use client";

import type { Match, Player, Team } from "@/lib/supabase/types";
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
import { Volleyball } from "lucide-react";
import { useEffect, useState } from "react";
import { useDb } from "../providers/database-provider";
import { toast } from "@/hooks/use-toast";
import { MatchManagedTeamSetup } from "./match-managed-setup";
import { useRouter } from "next/navigation";

type MatchStartDialogProps = {
  match: Match;
};

export default function MatchStartDialog({ match }: MatchStartDialogProps) {
  const { db } = useDb();
  const router = useRouter();
  const [managedTeam, setManagedTeam] = useState<Team | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

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

  const loadTeamPlayers = async (team: Team) => {
    if (!db) return;
    setIsLoadingPlayers(true);
    try {

      // const supabase = createClient();

      // const playersResponse = await supabase
      //   .from("players")
      //   .select("*")
      //   .eq("team_id", teamId);

      // if (playersResponse.error) throw playersResponse.error;

      const playerDocs = await db.players
        .find({
          selector: {
            team_id: team.id as string,
          },
        })
        .exec();

      setPlayers(playerDocs.map((doc) => doc.toJSON()));
      setAvailablePlayers([]);
    } catch (error) {
      console.error("Failed to load players:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load players",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const onSetupComplete = async () => {
    if (!db) return;
    if(!managedTeam) return;
    setIsLoading(true);
    try {
      // Save available players for managed team and start the match
      const matchUpdatedFields: Partial<Match> = {
        status: "live",
        updated_at: new Date().toISOString(),
      };
      if(managedTeam.id !== match.home_team_id) {
        matchUpdatedFields.home_available_players = availablePlayers;
      } else {
        matchUpdatedFields.away_available_players = availablePlayers;
      }
      await db?.matches.findOne(match.id).update({
        $set: matchUpdatedFields,
      });
      const params = new URLSearchParams();
      params.set('team', managedTeam!.id)

      router.push(`/matches/${match.id}/live?${params.toString()}`);
    } catch (error) {
      console.error("Failed to start match:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start match",
      });
    } finally {
      setIsLoading(false);
    }
  };

  async function onManagedTeamSelected(teamId: string): Promise<void> {
    let selectedTeam;
    if (teamId === awayTeam?.id) {
      selectedTeam = awayTeam;
    } else {
      selectedTeam = homeTeam;
    }
    setManagedTeam(selectedTeam);
    await loadTeamPlayers(selectedTeam!);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Volleyball className="h-4 w-4 mr-2" />
          Start
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Match Setup</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <MatchManagedTeamSetup
            homeTeam={homeTeam!}
            awayTeam={awayTeam!}
            onTeamSelected={onManagedTeamSelected}
          />
          {managedTeam && players && (
            <MatchLineupSetup
              match={match}
              players={players}
              availablePlayers={availablePlayers}
              setAvailablePlayers={setAvailablePlayers}
            />
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={onSetupComplete}
            className="w-full"
            disabled={isLoading || availablePlayers.length < 6}
          >
            Start Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
