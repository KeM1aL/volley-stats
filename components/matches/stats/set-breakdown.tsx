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
} from "recharts";
import { ScorePoint, Set } from "@/lib/supabase/types";

interface SetBreakdownProps {
  sets: Set[];
  points: ScorePoint[];
}

export function SetBreakdown({ sets, points }: SetBreakdownProps) {
  const setData = sets.map((set) => {
    const setPoints = points.filter((p) => p.set_id === set.id);
    return {
      set: `Set ${set.set_number}`,
      homeScore: set.home_score,
      awayScore: set.away_score,
      serves: setPoints.filter((p) => p.point_type === "serve").length,
      spikes: setPoints.filter((p) => p.point_type === "spike").length,
      blocks: setPoints.filter((p) => p.point_type === "block").length,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {sets.map((set) => (
          <Card key={set.id}>
            <CardHeader>
              <CardTitle>Set {set.set_number}</CardTitle>
              <CardDescription>
                Score: {set.home_score} - {set.away_score}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Duration: {Math.round(set.home_score + set.away_score * 0.75)} minutes</p>
                <p>Points Played: {set.home_score + set.away_score}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Set Statistics</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="set" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="serves" stackId="a" fill="hsl(var(--chart-1))" name="Serves" />
              <Bar dataKey="spikes" stackId="a" fill="hsl(var(--chart-2))" name="Spikes" />
              <Bar dataKey="blocks" stackId="a" fill="hsl(var(--chart-3))" name="Blocks" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}