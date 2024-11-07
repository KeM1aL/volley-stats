"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Match, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";

interface TeamPerformanceProps {
  match: Match;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
}

export function TeamPerformance({
  match,
  sets,
  points,
  stats,
}: TeamPerformanceProps) {
  const pointTypes = points.reduce(
    (acc, point) => {
      if (point.scoring_team === "home") {
        acc.home[point.point_type] = (acc.home[point.point_type] || 0) + 1;
      } else {
        acc.away[point.point_type] = (acc.away[point.point_type] || 0) + 1;
      }
      return acc;
    },
    { home: {}, away: {} } as Record<"home" | "away", Record<string, number>>
  );

  const pointTypeData = Object.keys(pointTypes.home).map((type) => ({
    name: type.replace("_", " "),
    home: pointTypes.home[type] || 0,
    away: pointTypes.away[type] || 0,
  }));

  const successRates = stats.reduce(
    (acc, stat) => {
      const team =
        stat.player_id === match.home_team_id ? "home" : "away";
      if (stat.result === "success") {
        acc[team].success = (acc[team].success || 0) + 1;
      } else if (stat.result === "error") {
        acc[team].error = (acc[team].error || 0) + 1;
      }
      return acc;
    },
    { home: {}, away: {} } as Record<
      "home" | "away",
      Record<"success" | "error", number>
    >
  );

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Point Distribution</CardTitle>
            <CardDescription>
              Breakdown of points by type for each team
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pointTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="home"
                  fill="hsl(var(--chart-1))"
                  name="Home Team"
                />
                <Bar
                  dataKey="away"
                  fill="hsl(var(--chart-2))"
                  name="Away Team"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>
              Team performance analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "Home Success",
                      value: successRates.home.success || 0,
                    },
                    {
                      name: "Home Error",
                      value: successRates.home.error || 0,
                    },
                    {
                      name: "Away Success",
                      value: successRates.away.success || 0,
                    },
                    {
                      name: "Away Error",
                      value: successRates.away.error || 0,
                    },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}