"use client";

import { PlayerStat, Player, Set } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateMVPScore } from "@/lib/stats/calculations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface MVPCalculatorProps {
  stats: PlayerStat[];
  players: Player[];
  sets: Set[];
}

export function MVPAnalysis({ stats, players, sets }: MVPCalculatorProps) {
  const mvpScores = calculateMVPScore(stats, players, sets);
  const matchMVP = mvpScores.matchMVP;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Match MVP Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {matchMVP.player && (
          <div className="space-y-6">
            <div className="flex items-center justify-center p-6 bg-primary/5 rounded-lg">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={matchMVP.player.avatar_url || undefined} />
                  <AvatarFallback>
                    {matchMVP.player.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Match MVP
                </h3>
                <p className="text-lg font-medium mt-2">
                  {matchMVP.player.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Score: {matchMVP.score.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Set MVPs</h3>
              {mvpScores.setMVPs.map((mvp) => (
                <div
                  key={mvp.setNumber}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={mvp.player.avatar_url || undefined} />
                      <AvatarFallback>
                        {mvp.player.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{mvp.player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Set {mvp.setNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Score: {mvp.score.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
