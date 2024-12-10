"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDataLoading } from "@/hooks/use-data-loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
import type { Match, Player, PlayerStat, ScorePoint, Set, Team } from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetBreakdown } from "@/components/matches/stats/set-breakdown";
import { PlayerPerformance } from "@/components/matches/stats/player-performance";
import { ScoreProgression } from "@/components/matches/stats/score-progression";
import { TeamPerformance } from "@/components/matches/stats/team-performance";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";
import { MatchScoreDetails } from "@/components/matches/match-score-details";

export default function MatchStatsPage() {
  const { id: matchId } = useParams();
  const searchParams = useSearchParams();
  const managedTeamId = searchParams.get("team");

  const { data: match, isLoading: isLoadingMatch } = useDataLoading<Match>(
    "matches",
    { id: matchId }
  );

  const { data: points, isLoading: isLoadingPoints } = useDataLoading<ScorePoint>(
    "score_points",
    { match_id: matchId }
  );

  const { data: stats, isLoading: isLoadingStats } = useDataLoading<PlayerStat>(
    "player_stats",
    { match_id: matchId }
  );

  const { data: sets, isLoading: isLoadingSets } = useDataLoading<Set>(
    "sets",
    { match_id: matchId }
  );

  const { data: teams, isLoading: isLoadingTeams } = useDataLoading<Team>(
    "teams",
    match ? [match[0].home_team_id, match[0].away_team_id] : []
  );

  const { data: players, isLoading: isLoadingPlayers } = useDataLoading<Player>(
    "players",
    managedTeamId ? { team_id: managedTeamId } : null
  );

  const isLoading = 
    isLoadingMatch || 
    isLoadingPoints || 
    isLoadingStats || 
    isLoadingSets || 
    isLoadingTeams || 
    isLoadingPlayers;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!match || !teams || teams.length !== 2) {
    return <div>Match not found</div>;
  }

  const managedTeam = teams.find(team => team.id === managedTeamId);
  const opponentTeam = teams.find(team => team.id !== managedTeamId);

  if (!managedTeam || !opponentTeam) {
    return <div>Teams not found</div>;
  }

  // Rest of the component remains the same...
}