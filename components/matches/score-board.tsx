"use client";

import { useState, useEffect } from "react";
import { Match, Set, ScorePoint, Player } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Card, CardContent } from "@/components/ui/card";
import { CourtDiagram } from "./court-diagram";
import { useToast } from "@/hooks/use-toast";

type ScoreBoardProps = {
  match: Match;
  set: Set;
};

export function ScoreBoard({ match, set }: ScoreBoardProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const [pointDocs, playerDocs] = await Promise.all([
        db.score_points
          .find({
            selector: {
              match_id: match.id,
              set_id: set.id,
            },
          })
          .exec(),
        db.players
          .find({
            selector: {
              team_id: match.home_team_id,
            },
          })
          .exec(),
      ]);

      setPoints(pointDocs.map((doc) => doc.toJSON()));
      setPlayers(playerDocs.map((doc) => doc.toJSON()));
    };

    loadData();
  }, [db, match.id, set.id]);

  const handleAction = async (type: "win" | "lose" | "neutral") => {
    setIsLoading(true);
    try {
      if (type === "neutral") return;

      const isWin = type === "win";
      const scoringTeam = isWin ? "home" : "away";
      const newHomeScore = match.home_score + (isWin ? 1 : 0);
      const newAwayScore = match.away_score + (isWin ? 0 : 1);

      // Update match score
      await db?.matches.findOne(match.id).update({
        $set: {
          home_score: newHomeScore,
          away_score: newAwayScore,
        },
      });

      // Record point
      const point = await db?.score_points.insert({
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: set.id,
        scoring_team: scoringTeam,
        point_type: "opponent_error",
        player_id: selectedPlayer?.id || null,
        timestamp: new Date().toISOString(),
        home_score: newHomeScore,
        away_score: newAwayScore,
        current_rotation: set.current_lineup,
      });

      if (point) {
        setPoints([...points, point.toJSON()]);
      }
    } catch (error) {
      console.error("Failed to record action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record action",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    if (points.length === 0) return;

    setIsLoading(true);
    try {
      const lastPoint = points[points.length - 1];

      // Remove point
      await db?.score_points.findOne(lastPoint.id).remove();

      // Update match score
      await db?.matches.findOne(match.id).update({
        $set: {
          home_score: lastPoint.home_score - 1,
          away_score: lastPoint.away_score - 1,
        },
      });

      setPoints(points.slice(0, -1));
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to undo action",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">
                  {match.home_score} - {match.away_score}
                </div>
                <div className="text-sm text-muted-foreground">
                  Set {set.set_number}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <CourtDiagram players={players} />
    </>
  );
}
