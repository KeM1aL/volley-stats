"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Undo, Redo } from "lucide-react";
import type { Match, Player, PlayerStat, ScorePoint, Set, Substitution, Team } from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { PointType, Score, StatResult } from "@/lib/types";
import { useCommandHistory } from "@/hooks/use-command-history";
import { SetSetupCommand, SubstitutionCommand, PlayerStatCommand, ScorePointCommand } from "@/lib/commands/match-commands";

interface MatchState {
  match: Match | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  set: Set | null;
  points: ScorePoint[];
  sets: Set[];
  stats: PlayerStat[];
  score: Score;
}

const initialMatchState: MatchState = {
  match: null,
  homeTeam: null,
  awayTeam: null,
  set: null,
  points: [],
  sets: [],
  stats: [],
  score: { home: 0, away: 0 },
};

export default function LiveMatchPageCommand() {
  const { id: matchId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { db } = useDb();
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerById, setPlayerById] = useState<Map<string, Player>>(new Map());
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [isLoading, setIsLoading] = useState(true);
  const { history, canUndo, canRedo } = useCommandHistory();

  // ... (rest of your existing useEffect and loading logic remains the same)

  const onSetSetupComplete = useCallback(async (newSet: Set) => {
    if (!db) return;

    const command = new SetSetupCommand(
      matchState,
      newSet,
      db
    );

    try {
      await history.executeCommand(command);
      setMatchState((prev) => ({
        ...prev,
        set: newSet,
        sets: [...prev.sets, newSet],
        score: { home: 0, away: 0 },
        points: [],
        stats: [],
      }));
    } catch (error) {
      console.error("Failed to complete set setup:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete set setup",
      });
    }
  }, [db, matchState, history]);

  const onSubstitutionRecorded = useCallback(async (substitution: Substitution) => {
    if (!db || !matchState.set) return;

    const command = new SubstitutionCommand(
      matchState,
      substitution,
      db
    );

    try {
      await history.executeCommand(command);
      setMatchState((prev) => ({
        ...prev,
        set: {
          ...prev.set!,
          current_lineup: {
            ...prev.set!.current_lineup,
            [substitution.position]: substitution.player_in_id,
          },
        },
      }));

      toast({
        title: "Substitution recorded",
        description: `Player #${playerById.get(substitution.player_out_id)!.number} substituted for ${playerById.get(substitution.player_in_id)!.number}`,
      });
    } catch (error) {
      console.error("Failed to record substitution:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record substitution",
      });
    }
  }, [db, matchState, history, playerById]);

  const onPlayerStatRecorded = useCallback(async (stat: PlayerStat) => {
    if (!db || !matchState.set) return;

    let point: ScorePoint | undefined;
    if (stat.result === StatResult.ERROR || stat.result === StatResult.SUCCESS) {
      const pointType = stat.stat_type as PointType;
      if (Object.values(PointType).includes(pointType)) {
        const isSuccess = stat.result === StatResult.SUCCESS;
        const isError = stat.result === StatResult.ERROR;
        const newHomeScore = matchState.score.home + (isSuccess ? 1 : 0);
        const newAwayScore = matchState.score.away + (isError ? 1 : 0);

        point = {
          id: crypto.randomUUID(),
          match_id: stat.match_id,
          set_id: stat.set_id,
          scoring_team: isSuccess ? "home" : "away",
          point_type: pointType,
          player_id: stat.player_id,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          home_score: newHomeScore,
          away_score: newAwayScore,
          current_rotation: matchState.set.current_lineup,
        };
      }
    }

    const command = new PlayerStatCommand(
      matchState,
      stat,
      point,
      db
    );

    try {
      await history.executeCommand(command);
      setMatchState((prev) => ({
        ...prev,
        stats: [...prev.stats, stat],
        points: point ? [...prev.points, point] : prev.points,
        score: point ? { home: point.home_score, away: point.away_score } : prev.score,
      }));

      if (point) {
        await onPointRecorded(point);
      }

      toast({
        title: "Stat recorded",
        description: `${stat.stat_type} ${stat.result} recorded`,
      });
    } catch (error) {
      console.error("Failed to record stat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record stat",
      });
    }
  }, [db, matchState, history]);

  const onPointRecorded = useCallback(async (point: ScorePoint) => {
    if (!db || !matchState.set || !matchState.match) return;

    const command = new ScorePointCommand(
      matchState,
      point,
      db
    );

    try {
      await history.executeCommand(command);
      setMatchState((prev) => ({
        ...prev,
        points: [...prev.points, point],
        score: { home: point.home_score, away: point.away_score },
      }));

      // ... (rest of your existing point recording logic remains the same)
    } catch (error) {
      console.error("Failed to record point:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record point",
      });
    }
  }, [db, matchState, history]);

  const handleUndo = async () => {
    try {
      await history.undo();
      // Reload match state after undo
      await loadMatchData();
      toast({
        title: "Action undone",
        description: "The last action has been undone",
      });
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to undo action",
      });
    }
  };

  const handleRedo = async () => {
    try {
      await history.redo();
      // Reload match state after redo
      await loadMatchData();
      toast({
        title: "Action redone",
        description: "The last undone action has been redone",
      });
    } catch (error) {
      console.error("Failed to redo action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to redo action",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <LiveMatchHeader
          match={matchState.match}
          sets={matchState.sets}
          homeTeam={matchState.homeTeam}
          awayTeam={matchState.awayTeam}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRedo}
            disabled={!canRedo}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ... (rest of your existing JSX remains the same) */}
    </div>
  );
}