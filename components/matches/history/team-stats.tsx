"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Match } from "@/lib/supabase/types";

type TeamStatsProps = {
  teamId: string;
  matches: Match[];
};

export function TeamStats({ teamId, matches }: TeamStatsProps) {
  const teamMatches = matches.filter(
    (match) =>
      match.home_team_id === teamId || match.away_team_id === teamId
  );

  const wins = teamMatches.filter((match) => {
    const isHome = match.home_team_id === teamId;
    return isHome
      ? match.home_score > match.away_score
      : match.away_score > match.home_score;
  }).length;

  const totalMatches = teamMatches.length;
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

  const totalPoints = teamMatches.reduce((sum, match) => {

    if(match.status !== 'completed') {
      return sum;
    }
    const myScore = match.home_team_id === teamId
      ? match.home_score
      : match.away_score;
    const opponentScore = match.home_team_id === teamId
      ? match.away_score
      : match.home_score;
    if(opponentScore > myScore + 1) {
      return sum;
    }
    if(myScore > opponentScore + 1) {
      return sum + 3;
    }
    if(myScore > opponentScore) {
      return sum + 2;
    }
    return sum + 1;
  }, 0);

  const averagePoints = totalMatches > 0
    ? totalPoints / totalMatches
    : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Win Rate</CardTitle>
          <CardDescription>Overall performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {winRate.toFixed(1)}%
          </div>
          <p className="text-sm text-muted-foreground">
            {wins} wins out of {totalMatches} matches
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Points</CardTitle>
          <CardDescription>Points per match</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {averagePoints.toFixed(1)}
          </div>
          <p className="text-sm text-muted-foreground">
            {totalPoints} total points
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
          <CardDescription>Recent performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            {teamMatches.slice(-5).map((match, index) => {
              const isWin =
                (match.home_team_id === teamId &&
                  match.home_score > match.away_score) ||
                (match.away_team_id === teamId &&
                  match.away_score > match.home_score);
              return (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    isWin ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Last 5 matches
          </p>
        </CardContent>
      </Card>
    </>
  );
}