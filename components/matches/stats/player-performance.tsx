"use client";

import { useState } from "react";
import { PlayerStat, Team, Player, Set } from "@/lib/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatResult, StatType, PlayerPosition } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";

interface PlayerPerformanceProps {
  managedTeam: Team;
  opponentTeam: Team;
  players: Player[];
  stats: PlayerStat[];
  sets: Set[];
}

interface PlayerSetStats extends Record<StatType, Record<StatResult | "all", number>> {}

export function PlayerPerformance({
  managedTeam,
  opponentTeam,
  players,
  stats,
  sets,
}: PlayerPerformanceProps) {
  const [selectedSet, setSelectedSet] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState("overview");

  const getPlayerSetStats = (
    playerId: string,
    setId?: string
  ): PlayerSetStats => {
    const filteredStats = stats.filter(
      (stat) =>
        stat.player_id === playerId && (setId ? stat.set_id === setId : true)
    );
    const playerStats: PlayerSetStats = {} as PlayerSetStats;
    Object.values(StatType).forEach((type) => {
      const statResult: Record<StatResult | "all", number> = {} as Record<
        StatResult | "all",
        number
      >;
      Object.values(StatResult).forEach((result) => {
        statResult[result] = filteredStats.filter(
          (s) => s.stat_type === type && s.result === result
        ).length;
      });

      statResult["all"] = filteredStats.filter(
        (s) => s.stat_type === type
      ).length;

      playerStats[type] = statResult;
    });
    return playerStats;
  };

  const getPlayerPerformanceData = () => {
    return players.map((player) => {
      const playerStats = getPlayerSetStats(
        player.id,
        selectedSet === "all" ? undefined : selectedSet
      );
      return {
        name: player.name,
        attacks: playerStats[StatType.SPIKE][StatResult.SUCCESS],
        serves: playerStats[StatType.SERVE][StatResult.SUCCESS],
        blocks: playerStats[StatType.BLOCK][StatResult.SUCCESS],
        receptions: playerStats[StatType.RECEPTION][StatResult.SUCCESS],
      };
    });
  };

  const getPlayerRadarData = (playerId: string) => {
    const stats = getPlayerSetStats(playerId);
    return [
      {
        subject: "Attacks",
        A:
          (stats[StatType.SPIKE][StatResult.SUCCESS] /
            (stats[StatType.SPIKE]["all"] || 1)) *
          100,
        fullMark: 100,
      },
      {
        subject: "Serves",
        A:
          (stats[StatType.SERVE][StatResult.SUCCESS] /
            (stats[StatType.SERVE]["all"] || 1)) *
          100,
        fullMark: 100,
      },
      {
        subject: "Blocks",
        A:
          (stats[StatType.BLOCK][StatResult.SUCCESS] /
            (stats[StatType.BLOCK]["all"] || 1)) *
          100,
        fullMark: 10,
      },
      {
        subject: "Reception",
        A:
          (stats[StatType.RECEPTION][StatResult.SUCCESS] /
            (stats[StatType.RECEPTION]["all"] || 1)) *
          100,
        fullMark: 100,
      },
    ];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Performance Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getPlayerPerformanceData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="attacks"
                          fill="hsl(var(--chart-1))"
                          name="Attacks"
                        />
                        <Bar
                          dataKey="serves"
                          fill="hsl(var(--chart-2))"
                          name="Serves"
                        />
                        <Bar
                          dataKey="blocks"
                          fill="hsl(var(--chart-3))"
                          name="Blocks"
                        />
                        <Bar
                          dataKey="receptions"
                          fill="hsl(var(--chart-5))"
                          name="Receptions"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-3 gap-4">
                {players.map((player) => (
                  <Card key={player.id}>
                    <CardHeader>
                      <CardTitle>{player.name} Performance Radar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={getPlayerRadarData(player.id)}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis />
                            <Radar
                              name={player.name}
                              dataKey="A"
                              stroke="hsl(var(--chart-1))"
                              fill="hsl(var(--chart-1))"
                              fillOpacity={0.6}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <div className="space-y-4">
              <div className="inline-flex">
                  <Button
                    variant={selectedSet === "all" ? "default" : "outline"}
                    onClick={() => setSelectedSet("all")}
                    className="rounded-r-none"
                  >
                    All Sets
                  </Button>
                  {sets.map((set, index) => (
                    <Button
                      variant={selectedSet === set.id ? "default" : "outline"}
                      key={set.id}
                      onClick={() => setSelectedSet(set.id)}
                      className={`
                        ${index === sets.length - 1 ? 'rounded-l-none' : ''},
                        ${index >= 0 && index < sets.length - 1 ? 'rounded-none border-x-0' : ''}
                      `}
                    >
                      Set {set.set_number}
                    </Button>
                  ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    {Object.values(StatType).map((type) => (
                      <TableHead key={type}>
                        {type.substring(0, 1).toUpperCase() + type.slice(1)}{" "}
                        (P/A/E)
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => {
                    const stats = getPlayerSetStats(
                      player.id,
                      selectedSet === "all" ? undefined : selectedSet
                    );

                    return (
                      <TableRow key={player.id}>
                        <TableCell className="font-medium">
                          {player.name}
                        </TableCell>
                        {Object.values(StatType).map((type) => (
                          <TableCell key={type}>
                            {stats[type][StatResult.SUCCESS]}/
                            {stats[type]["all"]}/{stats[type][StatResult.ERROR]}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
