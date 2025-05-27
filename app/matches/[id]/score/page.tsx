"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
import type {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { SetBreakdown } from "@/components/matches/stats/set-breakdown";
import { PlayerPerformance } from "@/components/matches/stats/player-performance";
import { ScoreProgression } from "@/components/matches/stats/score-progression";
import { TeamPerformance } from "@/components/matches/stats/team-performance";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";
import { MatchScoreDetails } from "@/components/matches/match-score-details";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { supabase } from "@/lib/supabase/client";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function LiveScorePage() {
  const { id: matchId } = useParams();
  const { isOnline, wasOffline } = useOnlineStatus();
  const searchParams = useSearchParams();
  const { localDb: db } = useLocalDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team>();
  const [awayTeam, setAwayTeam] = useState<Team>();
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [set, setSet] = useState<Set>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .eq("id", matchId as string)
          .single();

        if (matchError) throw matchError;
        setMatch(matchData);

        const { data: setsData, error: setsError } = await supabase
          .from("sets")
          .select("*")
          .eq("match_id", matchId as string)
          .order("set_number", { ascending: true });
        if (setsError) throw setsError;
        setSets(setsData);

        const { data: playerStatsData, error: playerStatsError } =
          await supabase
            .from("player_stats")
            .select("*")
            .eq("match_id", matchId as string)
            .order("created_at", { ascending: true });
        if (playerStatsError) throw playerStatsError;
        setStats(playerStatsData);

        const { data: scorePointsData, error: scorePointsError } =
          await supabase
            .from("score_points")
            .select("*")
            .eq("match_id", matchId as string)
            .order("created_at", { ascending: true });
        if (scorePointsError) throw scorePointsError;
        setPoints(scorePointsData);

        const managedTeamParam = searchParams.get("team");
        if (!managedTeamParam) {
          throw new Error("Please select your managed team");
        }

        const teamId = searchParams.get("team");

        if (
          teamId !== matchData.home_team_id &&
          teamId !== matchData.away_team_id
        ) {
          throw new Error("Managed Team not found");
        }

        const playerIds =
          teamId === matchData.home_team_id
            ? matchData.home_available_players
            : matchData.away_available_players;
        const { data: availablePlayersData, error: availablePlayersError } =
          await supabase
            .from("players")
            .select("*")
            .in("id", playerIds as string[]);
        if (availablePlayersError) throw availablePlayersError;
        setPlayers(availablePlayersData);

        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("*")
          .in("id", [matchData.home_team_id, matchData.away_team_id]);
        if (teamsError) throw teamsError;
        setHomeTeam(
          teamsData.find((team) => team.id === matchData.home_team_id)
        );
        setAwayTeam(
          teamsData.find((team) => team.id === matchData.away_team_id)
        );
        setManagedTeam(teamsData.find((team) => team.id === teamId));
        setOpponentTeam(teamsData.find((team) => team.id !== teamId));
      } catch (error) {
        console.error("Failed to load match data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load match data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [db, matchId, isOnline]);

  useEffect(() => {
    const channel = supabase
      .channel("changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sets",
          filter: "match_id=eq." + matchId,
        },
        (payload) => setSet(payload.new as Set)
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (set) {
      if (!sets || sets.length == 0) {
        setSets([set]);
      } else {
        const lastSet = sets[sets.length - 1];
        if (lastSet.set_number !== set.set_number) {
          setSets([...sets, set]);
        } else {
          setSets(sets.map((s) => (s.set_number === set.set_number ? set : s)));
        }
      }
    }
  }, [set]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Match Live Score</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <LiveMatchHeader
          match={match}
          sets={sets}
          homeTeam={homeTeam!}
          awayTeam={awayTeam!}
        />
      </div>
    </div>
  );
}
