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
} from "recharts";
import { Player, PlayerStat, ScorePoint } from "@/lib/supabase/types";

interface PlayerPerformanceProps {
  players: Player[];
  stats: PlayerStat[];
  points: ScorePoint[];
}

export function PlayerPerformance({
  players,
  stats,
  points,
}: PlayerPerformanceProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const playerStats = players.map((player) => {
    const playerPoints = points.filter((p) => p.player_id === player.id);
    const playerStatRecords = stats.filter((s) => s.player_id === player.id);

    return {
      id: player.id,
      name: player.name,
      number: player.number,
      serves: playerPoints.filter((p) => p.point_type === "serve").length,
      spikes: playerPoints.filter((p) => p.point_type === "spike").length,
      blocks: playerPoints.filter((p) => p.point_type === "block").length,
      errors: playerStatRecords.filter((s) => s.result === "error").length,
      successRate:
        (playerStatRecords.filter((s) => s.result === "success").length /
          playerStatRecords.length) *
        100 || 0,
    };
  });

  const selectedPlayerStats = selectedPlayer
    ? playerStats.find((p) => p.id === selectedPlayer)
    : null;

  const radarData = selectedPlayerStats
    ? [
        {
          subject: "Serves",
          value: selectedPlayerStats.serves,
          fullMark: Math.max(...playerStats.map((p) => p.serves)),
        },
        {
          subject: "Spikes",
          value: selectedPlayerStats.spikes,
          fullMark: Math.max(...playerStats.map((p) => p.spikes)),
        },
        {
          subject: "Blocks",
          value: selectedPlayerStats.blocks,
          fullMark: Math.max(...playerStats.map((p) => p.blocks)),
        },
        {
          subject: "Success Rate",
          value: selectedPlayerStats.successRate,
          fullMark: 100,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Player Analysis</h3>
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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={playerStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="serves"
                  fill="hsl(var(--chart-1))"
                  name="Serves"
                />
                <Bar
                  dataKey="spikes"
                  fill="hsl(var(--chart-2))"
                  name="Spikes"
                />
                <Bar
                  dataKey="blocks"
                  fill="hsl(var(--chart-3))"
                  name="Blocks"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {selectedPlayerStats && (
          <Card>
            <CardHeader>
              <CardTitle>
                Player Profile: {selectedPlayerStats.name}
              </CardTitle>
              <CardDescription>
                #{selectedPlayerStats.number}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Radar
                    name={selectedPlayerStats.name}
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}