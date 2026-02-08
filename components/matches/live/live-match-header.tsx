"use client";

import { useTranslations } from "next-intl";
import { Match, Set, Team, TeamMember } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { MatchScoreDetails } from "../match-score-details";

type LiveMatchHeaderProps = {
  match: Match;
  sets: Set[];
  homeTeam: Team;
  awayTeam: Team;
};

export function LiveMatchHeader({ match, sets, homeTeam, awayTeam }: LiveMatchHeaderProps) {
  const t = useTranslations("matches");

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-2">
        <div>
          <h1 className="text-2xl font-bold">{t("live.title")}</h1>
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
