"use client";

import { useState, useEffect } from "react";
import { Match, Set, ScorePoint, Player } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourtDiagram } from "./court-diagram";
import { useToast } from "@/hooks/use-toast";
import { Score } from "@/lib/types";
import { PointsHistory } from "./points-history";
import { Badge } from "@/components/ui/badge";

type ScoreBoardProps = {
  match: Match;
  set: Set;
  score: Score;
  points: ScorePoint[];
};

export function ScoreBoard({ match, set, score, points }: ScoreBoardProps) {
  const { db } = useDb();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const playerDocs = await db.players
        .find({
          selector: {
            team_id: match.home_team_id,
          },
        })
        .exec();

      setPlayers(playerDocs.map((doc) => doc.toJSON()));
    };

    loadData();
  }, [db, match.id, set.id]);

  return (
    <div className="gap-6">
      <div className="space-y-6">
        <div className="flex flex-row justify-center gap-2">
          <Card className="basis-1/3">
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div className="flex flex-col items-center space-y-2">
                  <h2 className="text-2xl font-bold">Home</h2>
                  <div className="text-4xl font-bold">{set.home_score}</div>
                  {set.server === "home" && (
                    <Badge variant="secondary" className="mt-2">
                      Serving
                    </Badge>
                  )}
                </div>
                <div className="text-6xl font-bold mx-4">-</div>
                <div className="flex flex-col items-center space-y-2">
                  <h2 className="text-2xl font-bold">Ext.</h2>
                  <div className="text-4xl font-bold">{set.away_score}</div>
                  {set.server === "away" && (
                    <Badge variant="secondary" className="mt-2">
                      Serving
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                Set {set.set_number}
              </div>
            </CardContent>
          </Card>
        </div>
        <PointsHistory points={points} />

        <CourtDiagram players={players} />
      </div>
    </div>
  );
}
