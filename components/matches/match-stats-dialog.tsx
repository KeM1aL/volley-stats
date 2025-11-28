"use client";

import type { Match, Team } from "@/lib/types";
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
import { useState, useEffect, useMemo } from "react";
import { useLocalDb } from "../providers/local-database-provider";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

type MatchStatsDialogProps = {
  match: Match;
};

export default function MatchEditDialog({ match }: MatchStatsDialogProps) {
  const { localDb: db } = useLocalDb();
  const { user } = useAuth(); // Use the auth context
  const router = useRouter();
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  async function onManagedTeamSelected(teamId: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("team", teamId);
    router.push(`/stats/${match.id}?${params.toString()}`);
    setIsDialogOpen(false); // Close dialog after selection
  }

  const handleOpenChange = (open: boolean) => {
    if (open && !isLoading && homeTeam && awayTeam) {
      if (userManagedTeams.length === 1) {
        onManagedTeamSelected(userManagedTeams[0].id);
        setIsDialogOpen(false);
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
        <Button variant="ghost" size="sm" title="View Stats" disabled={isLoading || userManagedTeams.length === 0}>
          <BarChart2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      {userManagedTeams.length > 1 && ( // Only show content if user can manage both
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
      )}
    </Dialog>
  );
}
