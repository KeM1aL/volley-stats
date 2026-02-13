"use client";

import { useTranslations } from "next-intl";
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
import { BarChart2, Cast, Pencil, Volleyball } from "lucide-react";
import { MatchManagedTeamSetup } from "./match-managed-setup";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useLocalDb } from "../providers/local-database-provider";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

type MatchStatsDialogProps = {
  match: Match;
};

export default function MatchScoreDialog({ match }: MatchStatsDialogProps) {
  const t = useTranslations("matches");
  const { localDb: db } = useLocalDb();
  const { user } = useAuth(); // Use the auth context
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false); // State to control dialog open/close

  const userManagedTeams = useMemo(() => {
    if (!user || !user.teamMembers) return [];
    const managedTeamIds = user.teamMembers.map(member => member.team_id);
    const teams: Team[] = [];
        const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    if (homeTeam && managedTeamIds.includes(homeTeam.id)) {
      teams.push(homeTeam);
    }
    if (awayTeam && managedTeamIds.includes(awayTeam.id)) {
      teams.push(awayTeam);
    }
    return teams;
  }, [user, match]);

  async function onManagedTeamSelected(teamId: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("team", teamId);
    router.push(`/matches/${match.id}/score?${params.toString()}`);
    setIsDialogOpen(false); // Close dialog after selection
  }

  const handleOpenChange = async (open: boolean) => {
    if (open && !isLoading && match) {

      if (userManagedTeams.length === 1) {
        onManagedTeamSelected(userManagedTeams[0].id);
        setIsDialogOpen(false);
      } else if (userManagedTeams.length === 0) {
        toast({
          variant: "destructive",
          title: t("dialog.permissionDenied"),
          description: t("dialog.noPermissionMessage"),
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
        <Button variant="ghost" size="sm" title={t("live.title")} disabled={isLoading || userManagedTeams.length === 0}>
          <Cast className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      {userManagedTeams.length > 1 && ( // Only show content if user can manage both
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("dialog.selectManagingTeam")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <MatchManagedTeamSetup
              homeTeam={match.home_team!}
              awayTeam={match.away_team!}
              onTeamSelected={onManagedTeamSelected}
            />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
