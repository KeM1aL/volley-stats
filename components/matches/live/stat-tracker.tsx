"use client";

import { useEffect, useState } from "react";
import {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/supabase/types";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent } from "@/components/ui/card";
import { StatType, StatResult, Score, PointType } from "@/lib/types";
import { StatButton, variants } from "./stat-button";
import { useToast } from "@/hooks/use-toast";
import { PlayerSelector } from "./player-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useCommandHistory } from "@/hooks/use-command-history";

type StatTrackerProps = {
  match: Match;
  opponentTeam: Team;
  managedTeam: Team;
  currentSet: Set;
  sets: Set[];
  stats: PlayerStat[];
  score: Score;
  points: ScorePoint[];
  onPoint: (point: ScorePoint) => Promise<void>;
  onStat: (stat: PlayerStat) => Promise<void>;
  onUndo: () => Promise<void>;
};

const colorData = [
  { color: "bg-red-500", border: "border-red-300" },
  { color: "bg-blue-500", border: "border-blue-300" },
  { color: "bg-green-500", border: "border-green-300" },
  { color: "bg-yellow-500", border: "border-yellow-300" },
  { color: "bg-purple-500", border: "border-purple-300" },
  { color: "bg-pink-500", border: "border-pink-300" },
  { color: "bg-indigo-500", border: "border-indigo-300" },
  { color: "bg-teal-500", border: "border-teal-300" },
  { color: "bg-orange-500", border: "border-orange-300" },
  { color: "bg-cyan-500", border: "border-cyan-300" },
  { color: "bg-lime-500", border: "border-lime-300" },
  { color: "bg-fuchsia-500", border: "border-fuchsia-300" },
]

export function StatTracker({
  match,
  currentSet,
  opponentTeam,
  managedTeam,
  sets,
  stats,
  points,
  score,
  onPoint,
  onStat,
  onUndo,
}: StatTrackerProps) {
  const { db } = useLocalDb();
  const { toast } = useToast();
  const { canUndo, canRedo } = useCommandHistory();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const setPlayerIds = Object.values(currentSet.current_lineup);
      const setPlayerDocs = await db.players.findByIds(setPlayerIds).exec();
      if (setPlayerDocs) {
        setPlayers(
          Array.from(setPlayerDocs.values()).map((doc) => doc.toJSON())
        );
      }
      setIsLoading(false);
    };

    if (!isLoading) {
      setIsLoading(true);
    }
    loadData();
  }, [db, match.id, currentSet]);

  const recordStat = async (type: StatType, result: StatResult) => {
    if (!selectedPlayer) {
      toast({
        title: "Select a player",
        description: "Please select a player before recording a stat",
        variant: "destructive",
      });
      return;
    }

    setIsRecording(true);
    try {
      const playerStat = {
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: currentSet.id,
        player_id: selectedPlayer.id,
        team_id: selectedPlayer.team_id,
        position: Object.entries(currentSet.current_lineup).find(
          ([_position, playerId]) => playerId === selectedPlayer.id
        )![0],
        stat_type: type,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlayerStat;
      await onStat(playerStat);
      setSelectedPlayer(null);
    } finally {
      setIsRecording(false);
    }
  };

  const recordPoint = async (actionTeamId: string, type: PointType, result: StatResult) => {
    setIsRecording(true);
    try {
      const isSuccess = result === StatResult.SUCCESS;
      const isError = result === StatResult.ERROR;
      const scoringTeamId = isSuccess ? managedTeam.id : opponentTeam.id;
      const newHomeScore = scoringTeamId === match.home_team_id ? score.home + 1 : score.home;
      const newAwayScore = scoringTeamId === match.away_team_id ? score.away + 1 : score.away;
      const point: ScorePoint = {
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: currentSet.id,
        scoring_team_id: scoringTeamId,
        point_type: type,
        player_id: null,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        home_score: newHomeScore,
        away_score: newAwayScore,
        current_rotation: currentSet!.current_lineup,
        player_stat_id: null,
        action_team_id: actionTeamId,
        result: isSuccess ? StatResult.SUCCESS : StatResult.ERROR
      };
      await onPoint(point);
    } finally {
      setIsRecording(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[120px] w-full" />
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-[100px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <CardContent className="space-y-1 p-0">
      <PlayerSelector
        players={players}
        selectedPlayer={selectedPlayer}
        onPlayerSelect={setSelectedPlayer}
      />
      <div className="space-y-0">
        {Object.values(StatType).map((type, index) => (
          <Card key={type} className={`w-full mx-auto overflow-hidden ${colorData[index].border} border-2`}>
            <div className="flex">
              {/* Vertical text on the left side */}
              <div className={`text-primary-foreground p-4 flex items-center justify-center relative ${colorData[index].color}`}>
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-xl font-bold origin-center">
                  {type.replace("_", " ").substring(0, 5)}
                </span>
              </div>
              <div className="flex-1">
                <CardContent className="p-1">
                  <div className="grid grid-cols-4 gap-2">
                    {Object.values(StatResult).map((result) => (
                      <StatButton
                        key={result}
                        result={result}
                        onClick={() => recordStat(type, result)}
                        disabled={isRecording || !selectedPlayer}
                        isLoading={isRecording}
                      />
                    ))}
                  </div>
                </CardContent>
              </div>
              <div className={`text-primary-foreground p-4 flex items-center justify-center relative ${colorData[index].color}`}>
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-xl font-bold origin-center">
                  {type.replace("_", " ").substring(0, 5)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Button
            onClick={() => recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.ERROR)}
            disabled={isRecording || isLoading}
            className={cn(
              "h-14 text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.ERROR]
            )}
          >
            <div>
              <div className="text-md font-medium">
                '{managedTeam.name}' Error
              </div>
              <div className="text-sm opacity-75">-1</div>
            </div>
          </Button>
          <Button
            onClick={() => recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.SUCCESS)}
            disabled={isRecording || isLoading}
            className={cn(
              "h-14 text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.SUCCESS]
            )}
          >
            <div>
              <div className="text-md font-medium">
                '{managedTeam.name}' Point
              </div>
              <div className="text-sm opacity-75">+1</div>
            </div>
          </Button>
          <Button
            onClick={() => recordPoint(opponentTeam.id, PointType.UNKNOWN, StatResult.ERROR)}
            disabled={isRecording || isLoading}
            className={cn(
              "h-14 text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.ERROR]
            )}
          >
            <div>
              <div className="text-md font-medium">
                '{opponentTeam.name}' Point
              </div>
              <div className="text-sm opacity-75">-1</div>
            </div>
          </Button>
          <Button
            onClick={() => recordPoint(opponentTeam.id, PointType.UNKNOWN, StatResult.SUCCESS)}
            disabled={isRecording || isLoading}
            className={cn(
              "h-14 text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.SUCCESS]
            )}
          >
            <div>
              <div className="text-md font-medium">
                '{opponentTeam.name}' Error
              </div>
              <div className="text-sm opacity-75">+1</div>
            </div>
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <div className="grid grid-cols-1">
          <Button
            variant="outline"
            onClick={() => onUndo()}
            disabled={isRecording || isLoading}
            className={cn(
              "h-12 text-lg font-semibold transition-transform active:scale-95"
            )}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Cancel Last Action
          </Button>
        </div>
      </div>
    </CardContent>
  );
}
