"use client";

import { useState } from "react";
import { Match, Set } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ScoreBoardProps = {
  match: Match;
  set: Set
};

export function ScoreBoard({ match, set }: ScoreBoardProps) {
  const { db } = useDb();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateScore = async (team: "home" | "away", increment: boolean) => {
    setIsUpdating(true);
    try {
      const field = `${team}_score` as const;
      const newScore = match[field] + (increment ? 1 : -1);
      if (newScore >= 0) {
        await db?.matches.findOne(match.id).update({
          $set: {
            [field]: newScore,
          },
        });
      }
    } catch (error) {
      console.error("Failed to update score:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <CardHeader>
        <CardTitle>Score Board</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Home Team</h3>
            <div className="text-4xl font-bold mb-4">{match.home_score}</div>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateScore("home", false)}
                disabled={isUpdating || match.home_score === 0}
              >
                -
              </Button>
              <Button
                size="sm"
                onClick={() => updateScore("home", true)}
                disabled={isUpdating}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-4">Away Team</h3>
            <div className="text-4xl font-bold mb-4">{match.away_score}</div>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateScore("away", false)}
                disabled={isUpdating || match.away_score === 0}
              >
                -
              </Button>
              <Button
                size="sm"
                onClick={() => updateScore("away", true)}
                disabled={isUpdating}
              >
                +
              </Button>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </div>
  );
}