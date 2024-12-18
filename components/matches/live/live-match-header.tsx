"use client";

import { Match, Set, Team } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { MatchScoreDetails } from "../match-score-details";

type LiveMatchHeaderProps = {
  match: Match;
  sets: Set[];
  homeTeam: Team;
  awayTeam: Team;
};

export function LiveMatchHeader({ match, sets, homeTeam, awayTeam }: LiveMatchHeaderProps) {
  
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-1">
        <div>
          <h1 className="text-2xl font-bold">Live Match</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>
        <div className="w-full ml-auto">
          <MatchScoreDetails match={match} sets={sets} homeTeam={homeTeam} awayTeam={awayTeam} />
        </div>
      </CardContent>
    </Card>
  );
}
