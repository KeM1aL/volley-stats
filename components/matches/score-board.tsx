"use client";

import { useState, useEffect } from "react";
import { Match, Set, ScorePoint, Player } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="gap-6">
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

        <CourtDiagram players={players} />
      </div>
    </div>
  );
}
