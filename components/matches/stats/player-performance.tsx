"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
} from "recharts";
import { Player, PlayerStat, Team, Set } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { GitCompareArrows } from "lucide-react";

interface PlayerPerformanceProps {
  players: Player[];
  stats: PlayerStat[];
  sets: Set[];
  managedTeam: Team;
  opponentTeam: Team;
}

export function PlayerPerformance({
  players,
  stats,
  sets,
  managedTeam,
  opponentTeam,
}: PlayerPerformanceProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [comparePlayer, setComparePlayer] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const calculatePlayerStats = (playerId: string) => {
    const playerStatRecords = stats.filter((s) => s.player_id === playerId);

    const serveStats = playerStatRecords.filter((s) => s.stat_type === "serve");
    const spikeStats = playerStatRecords.filter((s) => s.stat_type === "spike");
    const blockStats = playerStatRecords.filter((s) => s.stat_type === "block");
    const receptionStats = playerStatRecords.filter(
      (s) => s.stat_type === "reception"
    );

    return {
      serves: {
        total: serveStats.length,
        aces: serveStats.filter((s) => s.result === "success").length,
        errors: serveStats.filter((s) => s.result === "error").length,
        successRate:
          (serveStats.filter((s) => s.result === "success").length /
            serveStats.length) *
            100 || 0,
      },
      spikes: {
        total: spikeStats.length,
        kills: spikeStats.filter((p) => p.result === "success").length,
        errors: spikeStats.filter((s) => s.result === "error").length,
        successRate:
          (spikeStats.filter((s) => s.result === "success").length /
            spikeStats.length) *
            100 || 0,
      },
      blocks: {
        total: blockStats.length,
        points: blockStats.filter((p) => p.result === "success").length,
        errors: blockStats.filter((s) => s.result === "error").length,
        successRate:
          (blockStats.filter((s) => s.result === "success").length /
            blockStats.length) *
            100 || 0,
      },
      reception: {
        total: receptionStats.length,
        perfect: receptionStats.filter((s) => s.result === "success").length,
        errors: receptionStats.filter((s) => s.result === "error").length,
        successRate:
          (receptionStats.filter((s) => s.result === "success").length /
            receptionStats.length) *
            100 || 0,
      },
    };
  };

  const selectedPlayerStats = selectedPlayer
    ? calculatePlayerStats(selectedPlayer)
    : null;
  const comparePlayerStats = comparePlayer
    ? calculatePlayerStats(comparePlayer)
    : null;

  const getRadarData = (
    playerStats: ReturnType<typeof calculatePlayerStats>
  ) => [
    { subject: "Serve Success", value: playerStats.serves.successRate },
    { subject: "Spike Success", value: playerStats.spikes.successRate },
    { subject: "Block Success", value: playerStats.blocks.successRate },
    { subject: "Reception Success", value: playerStats.reception.successRate },
  ];

  const getPerformanceTrend = (playerId: string) => {
    return stats
      .filter((p) => p.player_id === playerId)
      .map((_, index) => ({
        point: index + 1,
        value:
          (stats
            .filter((s) => s.player_id === playerId)
            .slice(0, index + 1)
            .filter((s) => s.result === "success").length /
            (index + 1)) *
          100,
      }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Select
            value={selectedPlayer || undefined}
            onValueChange={setSelectedPlayer}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {players.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  #{player.number} {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPlayer && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComparison(!showComparison)}
              >
                <GitCompareArrows className="h-4 w-4 mr-2" />
                {showComparison ? "Hide Comparison" : "Compare Players"}
              </Button>

              {showComparison && (
                <Select
                  value={comparePlayer || undefined}
                  onValueChange={setComparePlayer}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select player to compare" />
                  </SelectTrigger>
                  <SelectContent>
                    {players
                      .filter((p) => p.id !== selectedPlayer)
                      .map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.number} {player.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      </div>

      {selectedPlayerStats && selectedPlayer && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Radar</CardTitle>
              <CardDescription>
                Overall success rates across skills
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={getRadarData(selectedPlayerStats)}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar
                    name={players.find((p) => p.id === selectedPlayer)?.name}
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  {comparePlayerStats && (
                    <Radar
                      name={players.find((p) => p.id === comparePlayer)?.name}
                      dataKey="value"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.6}
                    />
                  )}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>
                Success rate evolution during the match
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="point" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    data={getPerformanceTrend(selectedPlayer)}
                    type="monotone"
                    dataKey="value"
                    name={players.find((p) => p.id === selectedPlayer)?.name}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                  {comparePlayer && (
                    <Line
                      data={getPerformanceTrend(comparePlayer)}
                      type="monotone"
                      dataKey="value"
                      name={players.find((p) => p.id === comparePlayer)?.name}
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Statistics</CardTitle>
              <CardDescription>Breakdown by skill type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Serves</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total: {selectedPlayerStats.serves.total}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aces: {selectedPlayerStats.serves.aces}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Errors: {selectedPlayerStats.serves.errors}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Success Rate:{" "}
                        {selectedPlayerStats.serves.successRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Spikes</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total: {selectedPlayerStats.spikes.total}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Kills: {selectedPlayerStats.spikes.kills}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Errors: {selectedPlayerStats.spikes.errors}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Success Rate:{" "}
                        {selectedPlayerStats.spikes.successRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Blocks</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total: {selectedPlayerStats.blocks.total}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Points: {selectedPlayerStats.blocks.points}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Errors: {selectedPlayerStats.blocks.errors}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Success Rate:{" "}
                        {selectedPlayerStats.blocks.successRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Reception</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total: {selectedPlayerStats.reception.total}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Perfect: {selectedPlayerStats.reception.perfect}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Errors: {selectedPlayerStats.reception.errors}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Success Rate:{" "}
                        {selectedPlayerStats.reception.successRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {comparePlayerStats && (
            <Card>
              <CardHeader>
                <CardTitle>Comparison</CardTitle>
                <CardDescription>Head-to-head statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">Serves</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {players.find((p) => p.id === selectedPlayer)?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Aces: {selectedPlayerStats.serves.aces}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {selectedPlayerStats.serves.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {players.find((p) => p.id === comparePlayer)?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Aces: {comparePlayerStats.serves.aces}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {comparePlayerStats.serves.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Spikes</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Kills: {selectedPlayerStats.spikes.kills}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {selectedPlayerStats.spikes.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Kills: {comparePlayerStats.spikes.kills}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {comparePlayerStats.spikes.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Blocks</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Points: {selectedPlayerStats.blocks.points}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {selectedPlayerStats.blocks.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Points: {comparePlayerStats.blocks.points}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {comparePlayerStats.blocks.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Reception</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Perfect: {selectedPlayerStats.reception.perfect}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {selectedPlayerStats.reception.successRate.toFixed(1)}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Perfect: {comparePlayerStats.reception.perfect}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Success:{" "}
                          {comparePlayerStats.reception.successRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
