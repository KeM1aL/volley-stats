"use client";

import { useEffect, useState } from "react";
import { Match, Player, ScorePoint, Set } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatType, StatResult, PointType, Score } from "@/lib/types";
import { StatButton } from "./stat-button";
import { useToast } from "@/hooks/use-toast";
import { PlayerSelector } from "./player-selector";
import { LoadingSpinner } from "../../ui/loading-spinner";
import { Skeleton } from "../../ui/skeleton";

type StatTrackerProps = {
  match: Match;
  set: Set;
  onPoint: (point: ScorePoint) => void;
};

export function StatTracker({ match, set, onPoint }: StatTrackerProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Score>({ home: 0, away: 0 });
  const [selectedStatType, setSelectedStatType] = useState<StatType | "">("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const setPlayerIds = Object.values(set.current_lineup);
      const setPlayerDocs = await db.players.findByIds(setPlayerIds).exec();
      if (setPlayerDocs) {
        setPlayers(
          Array.from(setPlayerDocs.values()).map((doc) => doc.toJSON())
        );
      }
      setIsLoading(false);
    };

    if(!isLoading) {
      setIsLoading(true);
    }
    setScores({ home: set.home_score, away: set.away_score });
    loadData();
  }, [db, match.id, set.id]);

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
      const isSuccess = result === StatResult.SUCCESS;
      const isError = result === StatResult.ERROR;
      const newHomeScore = scores.home + (isSuccess ? 1 : 0);
      const newAwayScore = scores.away + (isError ? 1 : 0);
      setScores((prev) => ({ home: newHomeScore, away: newAwayScore }));

      await db?.player_stats.insert({
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: set.id,
        player_id: selectedPlayer.id,
        stat_type: type,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (result === StatResult.ERROR || result === StatResult.SUCCESS) {
        if (Object.values(PointType).includes(type as string as PointType)) {
          const pointType = type as string as PointType;
          const point = {
            id: crypto.randomUUID(),
            match_id: match.id,
            set_id: set.id,
            scoring_team: isSuccess ? "home" : "away",
            point_type: pointType,
            player_id: selectedPlayer.id,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            home_score: newHomeScore,
            away_score: newAwayScore,
            current_rotation: set.current_lineup,
          } as ScorePoint;

          await db?.score_points.insert(point);
          onPoint(point);
        }
      }

      toast({
        title: "Stat recorded",
        description: `${type} ${result} recorded for ${selectedPlayer.name}`,
      });
    } catch (error) {
      console.error("Failed to record stat:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record stat",
      });
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
      <CardContent className="space-y-2">
        <PlayerSelector
          players={players}
          selectedPlayer={selectedPlayer}
          onPlayerSelect={setSelectedPlayer}
        />
        {Object.values(StatType).map((type) => (
          <Card key={type} className="w-full max-w-3xl mx-auto overflow-hidden">
            <div className="flex">
              {/* Vertical text on the left side */}
              <div className="bg-primary text-primary-foreground p-4 flex items-center justify-center relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-xl font-bold origin-center">
                  {type.replace("_", " ").substring(0, 5)}
                </span>
              </div>
              <div className="flex-1">
                <CardContent className="p-2">
                  <div className="grid grid-cols-3 gap-2">
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
      </CardContent>
    </div>
  );
}
