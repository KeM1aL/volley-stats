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
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Match, ScorePoint, Set } from "@/lib/supabase/types";

interface SetBreakdownProps {
  match: Match,
  sets: Set[];
  points: ScorePoint[];
}

export function SetBreakdown({ match, sets, points }: SetBreakdownProps) {
  const setData = sets.map((set) => {
    const setPoints = points.filter((p) => p.set_id === set.id);
    const homePoints = setPoints.filter(p => p.scoring_team_id === match.home_team_id);
    const awayPoints = setPoints.filter(p => p.scoring_team_id === match.away_team_id);

    return {
      set: `Set ${set.set_number}`,
      homeScore: set.home_score,
      awayScore: set.away_score,
      serves: setPoints.filter((p) => p.point_type === "serve").length,
      spikes: setPoints.filter((p) => p.point_type === "spike").length,
      blocks: setPoints.filter((p) => p.point_type === "block").length,
      errors: setPoints.filter((p) => p.point_type === "unknown").length,
      homeServes: homePoints.filter(p => p.point_type === "serve").length,
      homeSpikes: homePoints.filter(p => p.point_type === "spike").length,
      homeBlocks: homePoints.filter(p => p.point_type === "block").length,
      homeErrors: homePoints.filter(p => p.point_type === "unknown").length,
      awayServes: awayPoints.filter(p => p.point_type === "serve").length,
      awaySpikes: awayPoints.filter(p => p.point_type === "spike").length,
      awayBlocks: awayPoints.filter(p => p.point_type === "block").length,
      awayErrors: awayPoints.filter(p => p.point_type === "unknown").length,
    };
  });

  const getMomentumData = (set: Set) => {
    const setPoints = points
      .filter((p) => p.set_id === set.id)
      .map((point, index) => ({
        point: index + 1,
        momentum: calculateMomentum(points.slice(0, index + 1).filter(p => p.set_id === set.id)),
        homeScore: point.home_score,
        awayScore: point.away_score,
      }));

    return setPoints;
  };

  const calculateMomentum = (points: ScorePoint[]) => {
    // Calculate momentum based on the last 5 points
    const recentPoints = points.slice(-5);
    const homePoints = recentPoints.filter(p => p.scoring_team_id === match.home_team_id).length;
    const awayPoints = recentPoints.filter(p => p.scoring_team_id === match.away_team_id).length;
    return ((homePoints - awayPoints) / 5) * 100; // Normalize to -100 to 100
  };

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
                <p>Point Distribution:</p>
                <div className="pl-4 space-y-1 text-sm">
                  <p>Serves: {points.filter(p => p.set_id === set.id && p.point_type === 'serve').length}</p>
                  <p>Spikes: {points.filter(p => p.set_id === set.id && p.point_type === 'spike').length}</p>
                  <p>Blocks: {points.filter(p => p.set_id === set.id && p.point_type === 'block').length}</p>
                  <p>Opponent Errors: {points.filter(p => p.set_id === set.id && p.point_type === 'unknown').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Point Distribution by Set</CardTitle>
          <CardDescription>Breakdown of scoring methods in each set</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="set" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="serves" stackId="home" fill="hsl(var(--chart-1))" name="Serves" />
              <Bar dataKey="spikes" stackId="home" fill="hsl(var(--chart-2))" name="Spikes" />
              <Bar dataKey="blocks" stackId="home" fill="hsl(var(--chart-3))" name="Blocks" />
              <Bar dataKey="errors" stackId="home" fill="hsl(var(--chart-4))" name="Opponent Errors" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Comparison by Set</CardTitle>
          <CardDescription>Point distribution comparison between teams</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="set" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="homeServes" stackId="home" fill="hsl(var(--chart-1))" name="Home Serves" />
              <Bar dataKey="homeSpikes" stackId="home" fill="hsl(var(--chart-2))" name="Home Spikes" />
              <Bar dataKey="homeBlocks" stackId="home" fill="hsl(var(--chart-3))" name="Home Blocks" />
              <Bar dataKey="awayServes" stackId="away" fill="hsl(var(--chart-1))" name="Away Serves" opacity={0.5} />
              <Bar dataKey="awaySpikes" stackId="away" fill="hsl(var(--chart-2))" name="Away Spikes" opacity={0.5} />
              <Bar dataKey="awayBlocks" stackId="away" fill="hsl(var(--chart-3))" name="Away Blocks" opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}