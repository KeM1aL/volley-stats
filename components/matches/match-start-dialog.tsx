"use client";

import type { Match, TeamMember, Team } from "@/lib/types";
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
import { useEffect, useState, useMemo } from "react";
import { useLocalDb } from "../providers/local-database-provider";
import { toast } from "@/hooks/use-toast";
import { MatchManagedTeamSetup } from "./match-managed-setup";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

type MatchStartDialogProps = {
  match: Match;
};

export default function MatchStartDialog({ match }: MatchStartDialogProps) {
  const { localDb: db } = useLocalDb();
  const { user } = useAuth(); // Use the auth context
  const router = useRouter();
  const [managedTeam, setManagedTeam] = useState<Team | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<TeamMember[] | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State to control dialog open/close

  useEffect(() => {
    // if (!isDialogOpen) return;
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
        setHomeTeam(teams.find(t => t.id === match.home_team_id)?.toJSON() || null);
        setAwayTeam(teams.find(t => t.id === match.away_team_id)?.toJSON() || null);
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
  }, [db, match.id, isDialogOpen]);

  const userManagedTeams = useMemo(() => {
    if (!user || !user.teamMembers) return [];
    const managedTeamIds = user.teamMembers.map(member => member.team_id);
    const teams: Team[] = [];
    if (homeTeam && managedTeamIds.includes(homeTeam.id)) {
      teams.push(homeTeam);
    }
    if (awayTeam && managedTeamIds.includes(awayTeam.id)) {
      teams.push(awayTeam);
    }
    return teams;
  }, [user, homeTeam, awayTeam]);

  const loadTeamPlayers = async (team: Team) => {
    if (!db) return;
    setIsLoadingPlayers(true);
    try {
      const playerDocs = await db.team_members
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
      if(managedTeam.id === match.home_team_id) {
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

  const handleOpenChange = async (open: boolean) => {
    if (open && !isLoading && homeTeam && awayTeam) {
      if (userManagedTeams.length === 1) {
        const selectedTeam = userManagedTeams[0];
        setManagedTeam(selectedTeam);
        await loadTeamPlayers(selectedTeam);
        setIsDialogOpen(true);
      } else if (userManagedTeams.length === 0) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to manage either team in this match.",
        });
        setIsDialogOpen(false);
      } else {
        setIsDialogOpen(true);
      }
    } else if (!open) {
      setIsDialogOpen(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Start Match" disabled={isLoading || userManagedTeams.length === 0}>
          <Volleyball className="h-4 w-4" />
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
              disabled={isLoading}
            >
              Start Match
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
