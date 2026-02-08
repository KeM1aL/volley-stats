"use client";

import { useTranslations } from "next-intl";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScorePoint, PlayerStat, TeamMember, Team, Set } from "@/lib/types";
import {
  Server,
  Zap,
  Shield,
  ArrowDownCircle,
  UserCheck,
  HelpCircle,
  User,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ScorePointsPanelProps {
  scorePoints: ScorePoint[];
  playerStats: PlayerStat[];
  playerById: Map<string, TeamMember>;
  currentSet?: Set | null;
  homeTeam: Team;
  awayTeam: Team;
  managedTeamId: string;
}

interface ScorePointCardProps {
  scorePoint: ScorePoint;
  playerStat?: PlayerStat;
  player?: TeamMember;
  homeTeam: Team;
  awayTeam: Team;
  isManagedTeamPoint: boolean;
}

// Helper function to get icon for point type
const getPointTypeIcon = (pointType: string) => {
  switch (pointType) {
    case "serve":
      return <Server className="h-4 w-4 text-blue-500" />;
    case "spike":
      return <Zap className="h-4 w-4 text-orange-500" />;
    case "block":
      return <Shield className="h-4 w-4 text-purple-500" />;
    case "reception":
      return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
    case "defense":
      return <UserCheck className="h-4 w-4 text-cyan-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-gray-500" />;
  }
};

// Helper function to get color class for point type badge
const getPointTypeColor = (pointType: string) => {
  switch (pointType) {
    case "serve":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "spike":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "block":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "reception":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "defense":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: string) => {
  try {
    return format(new Date(timestamp), "HH:mm:ss");
  } catch {
    return timestamp;
  }
};

// ScorePointCard Component
const ScorePointCard = ({
  scorePoint,
  playerStat,
  player,
  homeTeam,
  awayTeam,
  isManagedTeamPoint,
}: ScorePointCardProps) => {
  const scoringTeam =
    scorePoint.scoring_team_id === homeTeam.id ? homeTeam : awayTeam;
  const pointTypeIcon = getPointTypeIcon(scorePoint.point_type);
  const pointTypeColor = getPointTypeColor(scorePoint.point_type);

  return (
    <div
      className={cn(
        "border rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2 transition-colors",
        scorePoint.scoring_team_id === homeTeam.id
          ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
          : "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      {/* Header: Point number, team badge, score */}
      <div className="flex items-center justify-between gap-1">
        <Badge variant="outline" className="text-[10px] sm:text-xs">
          #{scorePoint.point_number}
        </Badge>
        <Badge variant="secondary" className="text-[10px] sm:text-xs max-w-[80px] sm:max-w-none truncate">
          {scoringTeam.name}
        </Badge>
        <span className="font-bold text-xs sm:text-sm font-mono">
          {scorePoint.home_score} - {scorePoint.away_score}
        </span>
      </div>

      {/* Point type and result */}
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        {/* Player info (if available) - only for managed team */}
        {player && (
          <div className="flex items-center gap-1 text-[10px] sm:text-sm">
            <User className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="truncate max-w-[80px] sm:max-w-none">
              {player.name} (#{player.number})
            </span>
          </div>
        )}
        <div className="[&>svg]:h-3 [&>svg]:w-3 sm:[&>svg]:h-4 sm:[&>svg]:w-4">
          {pointTypeIcon}
        </div>
        {scorePoint.point_type !== "unknown" && (
          <Badge className={cn(pointTypeColor, "text-[10px] sm:text-xs")}>
            {scorePoint.point_type}
          </Badge>
        )}
        <Badge
          variant={scorePoint.result === "success" ? "default" : "destructive"}
          className="text-[10px] sm:text-xs"
        >
          {scorePoint.result === "success" ? "✓" : "✗"} {scorePoint.result}
        </Badge>
      </div>
    </div>
  );
};

// Main ScorePointsPanel Component
export function ScorePointsPanel({
  scorePoints,
  playerStats,
  playerById,
  currentSet,
  homeTeam,
  awayTeam,
  managedTeamId,
}: ScorePointsPanelProps) {
  const t = useTranslations("matches");
  const [scoringTeamFilter, setScoringTeamFilter] = useState<string>("all");

  // Create lookup map for player stats
  const playerStatsMap = useMemo(
    () => new Map(playerStats.map((s) => [s.id, s])),
    [playerStats]
  );

  // Filter and sort score points (most recent first)
  const filteredPoints = useMemo(() => {
    // First filter by team
    let filtered = scorePoints;
    if (scoringTeamFilter === "home") {
      filtered = scorePoints.filter(
        (point) => point.scoring_team_id === homeTeam.id
      );
    } else if (scoringTeamFilter === "away") {
      filtered = scorePoints.filter(
        (point) => point.scoring_team_id === awayTeam.id
      );
    }

    // Then sort by timestamp descending (most recent first)
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // descending order
    });
  }, [scorePoints, scoringTeamFilter, homeTeam.id, awayTeam.id]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3 space-y-2 sm:space-y-3 flex-shrink-0 overflow-visible p-3 sm:p-6">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Points History {currentSet && (
                                <Badge variant="outline" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                                  Set {currentSet.set_number}
                                </Badge>
                              )}</CardTitle>

          {/* Team Filter */}
          <Select
            value={scoringTeamFilter}
            onValueChange={setScoringTeamFilter}
          >
            <SelectTrigger className="h-7 sm:h-8 text-[10px] sm:text-xs w-[100px] sm:w-[140px]">
              <SelectValue placeholder={t("live.scoringTeam")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("live.scoringTeam")}</SelectItem>
              <SelectItem value="home">{t("scoreboard.home")} Team</SelectItem>
              <SelectItem value="away">{t("scoreboard.away")} Team</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
        <div className="flex-1 overflow-y-auto px-2 sm:px-4">
          <div className="space-y-1.5 sm:space-y-2 pb-4 pt-2">
            {filteredPoints.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
                {scoringTeamFilter === "all"
                  ? t("live.noPointsRecorded")
                  : t("live.noPointsForTeam")}
              </p>
            ) : (
              filteredPoints.map((point) => (
                <ScorePointCard
                  key={point.id}
                  scorePoint={point}
                  playerStat={playerStatsMap.get(point.player_stat_id || "")}
                  player={
                    point.player_id
                      ? playerById.get(point.player_id)
                      : undefined
                  }
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  isManagedTeamPoint={point.scoring_team_id === managedTeamId}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
