"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Match,
  TeamMember,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/types";
import { MatchScoreDetails } from "@/components/matches/match-score-details";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";

interface MatchOverviewProps {
  match: Match;
  managedTeam: Team;
  opponentTeam: Team;
  points: ScorePoint[];
  stats: PlayerStat[];
  sets: Set[];
  players: TeamMember[];
}

function MatchOverview({ match, managedTeam, opponentTeam, points, stats, sets, players }: MatchOverviewProps) {
  const t = useTranslations("matches");

  return (
    <div id="overview-section-content">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("stats.matchOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <MatchScoreDetails
                match={match}
                sets={sets}
                homeTeam={
                  match.home_team_id === managedTeam?.id
                    ? managedTeam!
                    : opponentTeam!
                }
                awayTeam={
                  match.away_team_id === managedTeam?.id
                    ? managedTeam!
                    : opponentTeam!
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("stats.scoreProgression")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>{t("stats.totalSets")}: {sets.length}</p>
              <p>{t("stats.totalPoints")}: {points.length}</p>
              <p>{t("stats.duration")}: {sets.length * 25} {t("stats.minutes")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <MVPAnalysis
        sets={sets}
        stats={stats}
        players={players}
      />
    </div>
  );
}

MatchOverview.displayName = "MatchOverview";

export { MatchOverview };
