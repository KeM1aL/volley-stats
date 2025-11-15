"use client";

import React, { useState, useEffect } from "react";
import { PlayerStat, Team, TeamMember, Set } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PlayerRole, StatType } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PlayerPerformancePanelProps {
  managedTeam: Team;
  stats: PlayerStat[];
  currentSet?: Set | null;
  playerById: Map<string, TeamMember>;
}

interface PlayerStats {
  playerId: string;
  playerName: string;
  playerNumber: number;
  serve: { success: number; error: number; total: number };
  spike: { success: number; error: number; total: number };
  block: { success: number; error: number; total: number };
  reception: {
    success: number;
    good: number;
    bad: number;
    error: number;
    total: number;
  };
  defense: { success: number; error: number; total: number };
  totalPoints: number;
  efficiency: number;
}

export function PlayerPerformancePanel({
  managedTeam,
  stats,
  currentSet,
  playerById,
}: PlayerPerformancePanelProps) {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);

  useEffect(() => {
    if (!currentSet) return;
    const setPlayerIds = Object.values(currentSet.current_lineup);
    const players: TeamMember[] = [];
    for (const playerId of setPlayerIds) {
      const player = playerById.get(playerId);
      if (player) {
        players.push(player);
      }
    }

    const liberoPlayerId = Object.keys(currentSet.player_roles).find(
      (key) => currentSet.player_roles[key] === PlayerRole.LIBERO
    );
    if (liberoPlayerId) {
      players.push(playerById.get(liberoPlayerId)!);
    }
    // Calculate stats for each player
    const calculatedStats: PlayerStats[] = players.map((player) => {
      const playerStatsData = stats.filter(
        (stat) => stat.player_id === player.id
      );

      const serve = {
        success: playerStatsData.filter(
          (s) => s.stat_type === "serve" && s.result === "success"
        ).length,
        error: playerStatsData.filter(
          (s) => s.stat_type === "serve" && s.result === "error"
        ).length,
        total: playerStatsData.filter((s) => s.stat_type === "serve").length,
      };

      const spike = {
        success: playerStatsData.filter(
          (s) => s.stat_type === "spike" && s.result === "success"
        ).length,
        error: playerStatsData.filter(
          (s) => s.stat_type === "spike" && s.result === "error"
        ).length,
        total: playerStatsData.filter((s) => s.stat_type === "spike").length,
      };

      const block = {
        success: playerStatsData.filter(
          (s) => s.stat_type === "block" && s.result === "success"
        ).length,
        error: playerStatsData.filter(
          (s) => s.stat_type === "block" && s.result === "error"
        ).length,
        total: playerStatsData.filter((s) => s.stat_type === "block").length,
      };

      const reception = {
        success: playerStatsData.filter(
          (s) => s.stat_type === "reception" && s.result === "success"
        ).length,
        good: playerStatsData.filter(
          (s) => s.stat_type === "reception" && s.result === "good"
        ).length,
        bad: playerStatsData.filter(
          (s) => s.stat_type === "reception" && s.result === "bad"
        ).length,
        error: playerStatsData.filter(
          (s) => s.stat_type === "reception" && s.result === "error"
        ).length,
        total: playerStatsData.filter((s) => s.stat_type === "reception")
          .length,
      };

      const defense = {
        success: playerStatsData.filter(
          (s) => s.stat_type === "defense" && s.result === "success"
        ).length,
        error: playerStatsData.filter(
          (s) => s.stat_type === "defense" && s.result === "error"
        ).length,
        total: playerStatsData.filter((s) => s.stat_type === "defense").length,
      };

      const totalPoints = serve.success + spike.success + block.success;

      // Calculate efficiency (simple metric: (successes - errors) / total attempts)
      const totalAttempts =
        serve.total +
        spike.total +
        block.total +
        reception.total +
        defense.total;
      const totalSuccess =
        serve.success +
        spike.success +
        block.success +
        reception.success +
        defense.success;
      const totalErrors =
        serve.error +
        spike.error +
        block.error +
        reception.error +
        defense.error;
      const efficiency =
        totalAttempts > 0
          ? ((totalSuccess - totalErrors) / totalAttempts) * 100
          : 0;

      return {
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        serve,
        spike,
        block,
        reception,
        defense,
        totalPoints,
        efficiency: Math.round(efficiency),
      };
    });

    // Sort by total points descending
    calculatedStats.sort((a, b) => b.efficiency - a.efficiency);
    setPlayerStats(calculatedStats);
  }, [playerById, stats, currentSet]);

  const getEfficiencyIcon = (efficiency: number) => {
    if (efficiency > 50)
      return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (efficiency < 0)
      return <TrendingDown className="h-3 w-3 text-red-600" />;
    return <Minus className="h-3 w-3 text-yellow-600" />;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency > 50) return "text-green-600";
    if (efficiency < 0) return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Player Performance
          {currentSet && (
            <Badge variant="outline" className="ml-2">
              Set {currentSet.set_number}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="px-4">
          <div className="space-y-3 pb-4">
            {playerStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No stats recorded yet
              </p>
            ) : (
              playerStats.map((player) => (
                <div
                  key={player.playerId}
                  className="border rounded-lg p-3 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  {/* Player Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        #{player.playerNumber}
                      </Badge>
                      <span className="font-medium text-sm">
                        {player.playerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getEfficiencyIcon(player.efficiency)}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          getEfficiencyColor(player.efficiency)
                        )}
                      >
                        {player.efficiency}%
                      </span>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Points Scored</span>
                    <span className="font-bold text-primary text-sm">
                      {player.totalPoints}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Serve */}
                    {player.serve.total > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground font-medium">
                          Serve
                        </span>
                        <div className="flex gap-1">
                          <span className="text-green-600">
                            {player.serve.success}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">
                            {player.serve.error}
                          </span>
                          <span className="text-muted-foreground">
                            ({player.serve.total})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Spike */}
                    {player.spike.total > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground font-medium">
                          Spike
                        </span>
                        <div className="flex gap-1">
                          <span className="text-green-600">
                            {player.spike.success}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">
                            {player.spike.error}
                          </span>
                          <span className="text-muted-foreground">
                            ({player.spike.total})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Block */}
                    {player.block.total > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground font-medium">
                          Block
                        </span>
                        <div className="flex gap-1">
                          <span className="text-green-600">
                            {player.block.success}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">
                            {player.block.error}
                          </span>
                          <span className="text-muted-foreground">
                            ({player.block.total})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Reception */}
                    {player.reception.total > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground font-medium">
                          Reception
                        </span>
                        <div className="flex gap-1">
                          <span className="text-green-600">
                            {player.reception.success}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">
                            {player.reception.error}
                          </span>
                          <span className="text-muted-foreground">
                            ({player.reception.total})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Defense */}
                    {player.defense.total > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground font-medium">
                          Defense
                        </span>
                        <div className="flex gap-1">
                          <span className="text-green-600">
                            {player.defense.success}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">
                            {player.defense.error}
                          </span>
                          <span className="text-muted-foreground">
                            ({player.defense.total})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
