"use client";

import { useEffect, useState } from "react";
import { Match, Player, Set } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatType, StatResult, PointType } from "@/lib/types";
import { StatButton } from "./stat-button";
import { useToast } from "@/hooks/use-toast";
import { PlayerSelector } from "./player-selector";

type StatTrackerProps = {
  match: Match;
  set: Set;
};

export function StatTracker({ match, set }: StatTrackerProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedStatType, setSelectedStatType] = useState<StatType | "">("");
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const setPlayerIds = Object.values(set.current_lineup);
      const setPlayerDocs = await db.players.findByIds(setPlayerIds).exec();
      if (setPlayerDocs) {
        setPlayers(Array.from(setPlayerDocs.values()).map(doc => doc.toJSON()));
      }
    };

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
      const newHomeScore = match.home_score + (isSuccess ? 1 : 0);
      const newAwayScore = match.away_score + (!isSuccess ? 1 : 0);

      // Update match score
      await db?.matches.findOne(match.id).update({
        $set: {
          home_score: newHomeScore,
          away_score: newAwayScore,
        },
      });

      // Record stat
      await db?.player_stats.insert({
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: set.id,
        player_id: selectedPlayer.id,
        stat_type: type,
        result,
        created_at: new Date().toISOString(),
      });

      if (result === StatResult.ERROR || result === StatResult.SUCCESS) {
        if (Object.keys(PointType).includes(type)) {
          const pointType = type as string as PointType;
          // Record point
          const point = await db?.score_points.insert({
            id: crypto.randomUUID(),
            match_id: match.id,
            set_id: set.id,
            scoring_team: isSuccess ? "home" : "away",
            point_type: pointType,
            player_id: selectedPlayer.id,
            timestamp: new Date().toISOString(),
            home_score: newHomeScore,
            away_score: newAwayScore,
            current_rotation: set.current_lineup,
          });

          if (point) {
            // setPoints([...points, point.toJSON()]);
          }
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

  return (
    <div className="space-y-6">
      <CardContent className="space-y-4">
          <PlayerSelector
            players={players}
            selectedPlayer={selectedPlayer}
            onPlayerSelect={setSelectedPlayer}
          />
          {Object.values(StatType).map((type) => (
            <Card key={type}>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-4 capitalize text-center">
                  {type.replace("_", " ")}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(StatResult).map((result) => (
                    <StatButton
                      key={result}
                      result={result}
                      onClick={() => recordStat(type, result)}
                      disabled={isRecording || !selectedPlayer}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </CardContent>
    </div>
  );
}
