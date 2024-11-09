"use client";

import { useEffect, useState } from "react";
import {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
} from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Card, CardContent } from "@/components/ui/card";
import { StatType, StatResult, Score, PointType } from "@/lib/types";
import { StatButton, variants } from "./stat-button";
import { useToast } from "@/hooks/use-toast";
import { PlayerSelector } from "./player-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatTrackerProps = {
  match: Match;
  currentSet: Set;
  sets: Set[];
  stats: PlayerStat[];
  score: Score;
  points: ScorePoint[];
  onPoint: (point: ScorePoint) => Promise<void>;
  onStat: (stat: PlayerStat) => Promise<void>;
};

export function StatTracker({
  match,
  currentSet,
  sets,
  stats,
  points,
  score,
  onPoint,
  onStat,
}: StatTrackerProps) {
  const { db } = useDb();
  const { toast } = useToast();
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
  }, [db, match.id, currentSet.id]);

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
        stat_type: type,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlayerStat;
      await onStat(playerStat);
    } finally {
      setIsRecording(false);
    }
  };

  const recordPoint = async (type: PointType, result: StatResult) => {
    setIsRecording(true);
    try {
      const isSuccess = result === StatResult.SUCCESS;
      const isError = result === StatResult.ERROR;
      const newHomeScore = score.home + (isSuccess ? 1 : 0);
      const newAwayScore = score.away + (isError ? 1 : 0);
      const point = {
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: currentSet.id,
        scoring_team: isSuccess ? "home" : "away",
        point_type: type,
        player_id: null,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        home_score: newHomeScore,
        away_score: newAwayScore,
        current_rotation: currentSet!.current_lineup,
      } as ScorePoint;
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
    <div className="space-y-6">
      <CardContent className="space-y-6 p-4">
        <PlayerSelector
          players={players}
          selectedPlayer={selectedPlayer}
          onPlayerSelect={setSelectedPlayer}
        />
        <div className="space-y-2">
          {Object.values(StatType).map((type) => (
            <Card
              key={type}
              className="w-full max-w-3xl mx-auto overflow-hidden"
            >
              <div className="flex">
                {/* Vertical text on the left side */}
                <div className="bg-primary text-primary-foreground p-4 flex items-center justify-center relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-xl font-bold origin-center">
                    {type.replace("_", " ").substring(0, 5)}
                  </span>
                </div>
                <div className="flex-1">
                  <CardContent className="p-2">
                    <div className="grid grid-cols-3 gap-4">
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
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => recordPoint(PointType.UNKNOWN, StatResult.ERROR)}
              disabled={isRecording || isLoading}
              className={cn(
                "h-16 text-lg font-semibold transition-transform active:scale-95",
                variants[StatResult.ERROR]
              )}
            >
              <div>
                <div className="text-md font-medium">Opponent Point</div>
                <div className="text-sm opacity-75">-1</div>
              </div>
            </Button>
            <Button
              onClick={() => recordPoint(PointType.UNKNOWN, StatResult.SUCCESS)}
              disabled={isRecording || isLoading}
              className={cn(
                "h-16 text-lg font-semibold transition-transform active:scale-95",
                variants[StatResult.SUCCESS]
              )}
            >
              <div>
                <div className="text-md font-medium">Opponent Error</div>
                <div className="text-sm opacity-75">+1</div>
              </div>
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
