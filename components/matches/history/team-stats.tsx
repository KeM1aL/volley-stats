"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Match } from "@/lib/types";

type TeamStatsProps = {
  teamId: string;
  matches: Match[];
};

export function TeamStats({ teamId, matches }: TeamStatsProps) {
  const t = useTranslations("matches");
  const teamMatches = matches.filter(
    (match) =>
      match.home_team_id === teamId || match.away_team_id === teamId
  );

  const teamTerminatedMatches = teamMatches.filter(
    (match) => match.status === "completed"
  );

  const wins = teamTerminatedMatches.filter((match) => {
    const isHome = match.home_team_id === teamId;
    return isHome
      ? match.home_score! > match.away_score!
      : match.away_score! > match.home_score!;
  }).length;

  const totalMatches = teamTerminatedMatches.length;
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

  const totalPoints = teamTerminatedMatches.reduce((sum, match) => {

    if(match.status !== 'completed') {
      return sum;
    }
    const myScore = match.home_team_id === teamId
      ? match.home_score!
      : match.away_score!;
    const opponentScore = match.home_team_id === teamId
      ? match.away_score!
      : match.home_score!;
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
        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
          <CardTitle className="text-sm sm:text-base">{t("history.winRate")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm hidden sm:block">{t("history.overallPerformance")}</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {winRate.toFixed(1)}%
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            {t("history.winStats", { wins, totalMatches })}
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            {wins}/{totalMatches}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
          <CardTitle className="text-sm sm:text-base">{t("history.avgPoints")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm hidden sm:block">{t("history.pointsPerMatch")}</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="text-lg sm:text-2xl font-bold">
            {averagePoints.toFixed(1)}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            {t("history.totalPointsDesc", { total: totalPoints })}
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            {t("history.totalPointsShort", { total: totalPoints })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
          <CardTitle className="text-sm sm:text-base">{t("history.history")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm hidden sm:block">{t("history.recentPerformance")}</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="flex gap-1">
            {teamTerminatedMatches.slice(-5).map((match, index) => {
              const isWin =
                (match.home_team_id === teamId &&
                  match.home_score! > match.away_score!) ||
                (match.away_team_id === teamId &&
                  match.away_score! > match.home_score!);
              return (
                <div
                  key={index}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                    isWin ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              );
            })}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
            {t("history.last5")}
          </p>
        </CardContent>
      </Card>
    </>
  );
}