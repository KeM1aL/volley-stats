"use client";

import { useTranslations } from "next-intl";
import { PlayerStat, TeamMember, Set } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mvp } from "@/lib/report/metrics/mvp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface MVPCalculatorProps {
  stats: PlayerStat[];
  players: TeamMember[];
  sets: Set[];
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("");

export function MVPAnalysis({ stats, players, sets }: MVPCalculatorProps) {
  const t = useTranslations("matches");
  const playerById = new Map(players.map((player) => [player.id, player]));
  const matchResult = mvp(stats);
  const matchMVP = matchResult ? playerById.get(matchResult.playerId) : undefined;
  const setMVPs = [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .flatMap((set) => {
      const result = mvp(stats.filter((s) => s.set_id === set.id));
      const player = result ? playerById.get(result.playerId) : undefined;
      return result && player ? [{ setNumber: set.set_number, player, score: result.score }] : [];
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stats.mvpAnalysis")}</CardTitle>
      </CardHeader>
      <CardContent>
        {matchResult && matchMVP && (
          <div className="space-y-6">
            <div className="flex items-center justify-center p-6 bg-primary/5 rounded-lg">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={matchMVP.avatar_url || undefined} />
                  <AvatarFallback>{initials(matchMVP.name)}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {t("stats.matchMVP")}
                </h3>
                <p className="text-lg font-medium mt-2">{matchMVP.name}</p>
                <p className="text-sm text-muted-foreground mt-1">Score: {matchResult.score.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">{t("stats.setMVPs")}</h3>
              {setMVPs.map((setMvp) => (
                <div key={setMvp.setNumber} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={setMvp.player.avatar_url || undefined} />
                      <AvatarFallback>{initials(setMvp.player.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{setMvp.player.name}</p>
                      <p className="text-sm text-muted-foreground">Set {setMvp.setNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Score: {setMvp.score.toFixed(2)}</p>
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
