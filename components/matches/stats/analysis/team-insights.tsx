"use client";

import { Match, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";

interface TeamInsightsProps {
  match: Match;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
}

interface TeamMetric {
  title: string;
  homeValue: number;
  awayValue: number;
  trend: "home" | "away" | "neutral";
  description: string;
}

export function TeamInsights({ match, sets, points, stats }: TeamInsightsProps) {
  const calculateTeamMetrics = (): TeamMetric[] => {
    const metrics: TeamMetric[] = [];

    // Point distribution analysis
    const homePoints = points.filter((p) => p.scoring_team_id === match.home_team_id);
    const awayPoints = points.filter((p) => p.scoring_team_id === match.away_team_id);

    // Scoring efficiency
    const homeEfficiency = homePoints.length / points.length;
    const awayEfficiency = awayPoints.length / points.length;
    metrics.push({
      title: "Scoring Efficiency",
      homeValue: homeEfficiency * 100,
      awayValue: awayEfficiency * 100,
      trend: homeEfficiency > awayEfficiency ? "home" : "away",
      description: "Overall point-scoring effectiveness",
    });

    // Service performance
    const homeServes = stats.filter(
      (s) =>
        s.stat_type === "serve" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.home_team_id
    );
    const awayServes = stats.filter(
      (s) =>
        s.stat_type === "serve" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.away_team_id
    );

    const homeServeEfficiency =
      homeServes.filter((s) => s.result === "success").length / homeServes.length;
    const awayServeEfficiency =
      awayServes.filter((s) => s.result === "success").length / awayServes.length;

    metrics.push({
      title: "Service Effectiveness",
      homeValue: homeServeEfficiency * 100,
      awayValue: awayServeEfficiency * 100,
      trend: homeServeEfficiency > awayServeEfficiency ? "home" : "away",
      description: "Service success rate and point conversion",
    });

    // Attack conversion
    const homeAttacks = stats.filter(
      (s) =>
        s.stat_type === "spike" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.home_team_id
    );
    const awayAttacks = stats.filter(
      (s) =>
        s.stat_type === "spike" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.away_team_id
    );

    const homeAttackEfficiency =
      homeAttacks.filter((s) => s.result === "success").length /
      homeAttacks.length;
    const awayAttackEfficiency =
      awayAttacks.filter((s) => s.result === "success").length /
      awayAttacks.length;

    metrics.push({
      title: "Attack Conversion",
      homeValue: homeAttackEfficiency * 100,
      awayValue: awayAttackEfficiency * 100,
      trend: homeAttackEfficiency > awayAttackEfficiency ? "home" : "away",
      description: "Success rate of attack attempts",
    });

    // Defense effectiveness
    const homeBlocks = stats.filter(
      (s) =>
        s.stat_type === "block" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.home_team_id
    );
    const awayBlocks = stats.filter(
      (s) =>
        s.stat_type === "block" &&
        points.find((p) => p.player_id === s.player_id)?.scoring_team_id === match.away_team_id
    );

    const homeBlockEfficiency =
      homeBlocks.filter((s) => s.result === "success").length / homeBlocks.length;
    const awayBlockEfficiency =
      awayBlocks.filter((s) => s.result === "success").length / awayBlocks.length;

    metrics.push({
      title: "Defense Effectiveness",
      homeValue: homeBlockEfficiency * 100,
      awayValue: awayBlockEfficiency * 100,
      trend: homeBlockEfficiency > awayBlockEfficiency ? "home" : "away",
      description: "Blocking and defensive success rate",
    });

    return metrics;
  };

  const metrics = calculateTeamMetrics();

  const getTrendIcon = (trend: TeamMetric["trend"]) => {
    switch (trend) {
      case "home":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "away":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "neutral":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <h3 className="font-semibold">Team Performance Analysis</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{metric.title}</span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <div className="text-sm text-muted-foreground">Home</div>
                  <div className="text-xl font-bold">
                    {metric.homeValue.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Away</div>
                  <div className="text-xl font-bold">
                    {metric.awayValue.toFixed(1)}%
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}