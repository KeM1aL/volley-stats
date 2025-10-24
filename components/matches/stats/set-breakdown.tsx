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
import { Match, ScorePoint, Set, Team } from "@/lib/types";

interface SetBreakdownProps {
  match: Match,
  managedTeam: Team,
  opponentTeam: Team,
  sets: Set[];
  points: ScorePoint[];
  isPdfGenerating?: boolean; // Added for PDF generation context
}

export function SetBreakdown({ match, sets, points, managedTeam, opponentTeam }: SetBreakdownProps) {
  const setData = sets.map((set) => {
    const setPoints = points.filter((p) => p.set_id === set.id);

    return {
      set: `Set ${set.set_number}`,
      homeScore: set.home_score,
      awayScore: set.away_score,
      points: {
        serves: setPoints.filter((p) => p.point_type === "serve" && p.scoring_team_id === managedTeam.id).length,
        spikes: setPoints.filter((p) => p.point_type === "spike" && p.scoring_team_id === managedTeam.id).length,
        blocks: setPoints.filter((p) => p.point_type === "block" && p.scoring_team_id === managedTeam.id).length,
        errors: setPoints.filter((p) => p.point_type === "unknown" && p.scoring_team_id === managedTeam.id).length,
      },
      errors: {
        serves: setPoints.filter((p) => p.point_type === "serve" && p.scoring_team_id !== managedTeam.id).length,
        spikes: setPoints.filter((p) => p.point_type === "spike" && p.scoring_team_id !== managedTeam.id).length,
        blocks: setPoints.filter((p) => p.point_type === "block" && p.scoring_team_id !== managedTeam.id).length,
        points: setPoints.filter((p) => p.point_type === "unknown" && p.scoring_team_id !== managedTeam.id).length,
      }
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between gap-6">
        {sets.map((set) => (
          <Card key={set.id} className="basis-1/3">
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
                  <p>Serves: {points.filter(p => p.set_id === set.id && p.point_type === 'serve' && p.scoring_team_id === managedTeam.id).length}</p>
                  <p>Spikes: {points.filter(p => p.set_id === set.id && p.point_type === 'spike' && p.scoring_team_id === managedTeam.id).length}</p>
                  <p>Blocks: {points.filter(p => p.set_id === set.id && p.point_type === 'block' && p.scoring_team_id === managedTeam.id).length}</p>
                  <p>Opponent Errors: {points.filter(p => p.set_id === set.id && p.point_type === 'unknown' && p.scoring_team_id === managedTeam.id).length}</p>
                </div>
                <p>Error Distribution:</p>
                <div className="pl-4 space-y-1 text-sm">
                  <p>Serves: {points.filter(p => p.set_id === set.id && p.point_type === 'serve' && p.scoring_team_id !== managedTeam.id).length}</p>
                  <p>Spikes: {points.filter(p => p.set_id === set.id && p.point_type === 'spike' && p.scoring_team_id !== managedTeam.id).length}</p>
                  <p>Blocks: {points.filter(p => p.set_id === set.id && p.point_type === 'block' && p.scoring_team_id !== managedTeam.id).length}</p>
                  <p>Opponent Point: {points.filter(p => p.set_id === set.id && p.point_type === 'unknown' && p.scoring_team_id !== managedTeam.id).length}</p>
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
              <Bar dataKey="points.serves" stackId="home" fill="hsl(var(--chart-1))" name="Serves" />
              <Bar dataKey="points.spikes" stackId="home" fill="hsl(var(--chart-2))" name="Spikes" />
              <Bar dataKey="points.blocks" stackId="home" fill="hsl(var(--chart-3))" name="Blocks" />
              <Bar dataKey="points.errors" stackId="home" fill="hsl(var(--chart-4))" name="Opponent Errors" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Error Distribution by Set</CardTitle>
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
              <Bar dataKey="errors.serves" stackId="home" fill="hsl(var(--chart-1))" name="Serves" />
              <Bar dataKey="errors.spikes" stackId="home" fill="hsl(var(--chart-2))" name="Spikes" />
              <Bar dataKey="errors.blocks" stackId="home" fill="hsl(var(--chart-3))" name="Blocks" />
              <Bar dataKey="errors.points" stackId="home" fill="hsl(var(--chart-4))" name="Opponent Points" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
