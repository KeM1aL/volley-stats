"use client";

import { Player, PlayerStat, ScorePoint } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Star, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";

interface PlayerInsightsProps {
  player: Player;
  stats: PlayerStat[];
  points: ScorePoint[];
  teamType: "home" | "away";
}

interface PlayerMetric {
  title: string;
  value: number;
  trend: "up" | "down" | "neutral";
  description: string;
}

export function PlayerInsights({
  player,
  stats,
  points,
  teamType,
}: PlayerInsightsProps) {
  const calculatePlayerMetrics = (): PlayerMetric[] => {
    const playerStats = stats.filter((s) => s.player_id === player.id);
    const playerPoints = points.filter(
      (p) => p.player_id === player.id && p.scoring_team === teamType
    );

    // Calculate performance metrics
    const recentStats = playerStats.slice(-10);
    const olderStats = playerStats.slice(-20, -10);

    const recentSuccess =
      recentStats.filter((s) => s.result === "success").length / recentStats.length;
    const olderSuccess =
      olderStats.filter((s) => s.result === "success").length / olderStats.length;

    const metrics: PlayerMetric[] = [];

    // Overall efficiency
    const efficiency =
      playerStats.filter((s) => s.result === "success").length /
      playerStats.length;
    metrics.push({
      title: "Overall Efficiency",
      value: efficiency * 100,
      trend: recentSuccess > olderSuccess ? "up" : "down",
      description: `${player.name}'s overall success rate across all actions`,
    });

    // Scoring impact
    const scoringImpact = playerPoints.length / points.length;
    metrics.push({
      title: "Scoring Impact",
      value: scoringImpact * 100,
      trend: "neutral",
      description: `Percentage of team points contributed by ${player.name}`,
    });

    // Position-specific metrics
    switch (player.role) {
      case "Setter":
        const setterEfficiency = playerStats
          .filter((s) => s.stat_type === "spike")
          .filter((s) => s.result === "success").length;
        metrics.push({
          title: "Setting Efficiency",
          value: setterEfficiency,
          trend: "neutral",
          description: "Successfully converted setting opportunities",
        });
        break;
      case "Outside Hitter (Front)":
      case "Outside Hitter (Back)":
        const attackEfficiency =
          playerStats
            .filter((s) => s.stat_type === "spike")
            .filter((s) => s.result === "success").length /
          playerStats.filter((s) => s.stat_type === "spike").length;
        metrics.push({
          title: "Attack Efficiency",
          value: attackEfficiency * 100,
          trend: "neutral",
          description: "Successful attacks percentage",
        });
        break;
      case "Middle Blocker (Front)":
      case "Middle Blocker (Back)":
        const blockEfficiency =
          playerStats
            .filter((s) => s.stat_type === "block")
            .filter((s) => s.result === "success").length /
          playerStats.filter((s) => s.stat_type === "block").length;
        metrics.push({
          title: "Block Efficiency",
          value: blockEfficiency * 100,
          trend: "neutral",
          description: "Successful blocks percentage",
        });
        break;
      case "Libero":
        const receptionEfficiency =
          playerStats
            .filter((s) => s.stat_type === "reception")
            .filter((s) => s.result === "success").length /
          playerStats.filter((s) => s.stat_type === "reception").length;
        metrics.push({
          title: "Reception Efficiency",
          value: receptionEfficiency * 100,
          trend: "neutral",
          description: "Successful receptions percentage",
        });
        break;
    }

    return metrics;
  };

  const metrics = calculatePlayerMetrics();

  const getTrendIcon = (trend: PlayerMetric["trend"]) => {
    switch (trend) {
      case "up":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "neutral":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4" />
        <h3 className="font-semibold">
          #{player.number} {player.name} - {player.role}
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium">{metric.title}</span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="text-2xl font-bold mb-1">
                {metric.value.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}