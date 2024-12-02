"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Match, ScorePoint } from "@/lib/supabase/types";

interface ScoreProgressionProps {
  match: Match;
  points: ScorePoint[];
}

type Moment = {
  point: number;
  description: string;
  score: string;
};

export function ScoreProgression({ match, points }: ScoreProgressionProps) {
  const progressionData = points.map((point, index) => ({
    point: index + 1,
    home: point.home_score,
    away: point.away_score,
    difference: point.home_score - point.away_score,
    momentum: calculateMomentum(points.slice(0, index + 1)),
  }));

  function calculateMomentum(points: ScorePoint[]) {
    // Calculate momentum based on the last 5 points
    const recentPoints = points.slice(-5);
    const homePoints = recentPoints.filter(
      (p) => p.scoring_team_id === match.home_team_id
    ).length;
    const awayPoints = recentPoints.filter(
      (p) => p.scoring_team_id === match.away_team_id
    ).length;
    return ((homePoints - awayPoints) / 5) * 100; // Normalize to -100 to 100
  }

  const findKeyMoments = () => {
    const keyMoments: Moment[] = [];
    let maxLead = 0;
    let maxMomentum = 0;
    let comebacks: Moment[] = [];
    let lastLead = "none";

    progressionData.forEach((data, index) => {
      // Track maximum lead
      const currentLead = Math.abs(data.difference);
      if (currentLead > maxLead) {
        maxLead = currentLead;
        keyMoments.push({
          point: data.point,
          description: `Largest lead of ${maxLead} points`,
          score: `${data.home}-${data.away}`,
        });
      }

      // Track momentum shifts
      const currentMomentum = Math.abs(data.momentum);
      if (currentMomentum > maxMomentum) {
        maxMomentum = currentMomentum;
      }

      // Track lead changes
      const currentLeader =
        data.difference > 0 ? "home" : data.difference < 0 ? "away" : "tie";
      if (currentLeader !== lastLead && lastLead !== "none") {
        keyMoments.push({
          point: data.point,
          description: "Lead change",
          score: `${data.home}-${data.away}`,
        });
      }
      lastLead = currentLeader;

      // Track comebacks (when a team recovers from a 3+ point deficit)
      if (index > 0) {
        const prevDiff = progressionData[index - 1].difference;
        const currentDiff = data.difference;
        if (
          Math.abs(prevDiff) >= 3 &&
          Math.abs(currentDiff) < Math.abs(prevDiff)
        ) {
          comebacks.push({
            point: data.point,
            description: `Comeback from ${Math.abs(prevDiff)} point deficit`,
            score: `${data.home}-${data.away}`,
          });
        }
      }
    });

    return [...keyMoments, ...comebacks].sort((a, b) => a.point - b.point);
  };

  const keyMoments = findKeyMoments();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Score Progression</CardTitle>
          <CardDescription>Point-by-point score evolution</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="point" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="home"
                stroke="hsl(var(--chart-1))"
                name="Home"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="away"
                stroke="hsl(var(--chart-2))"
                name="Away"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score Difference</CardTitle>
          <CardDescription>Point differential over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="point" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="difference"
                stroke="hsl(var(--primary))"
                name="Difference"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Match Momentum</CardTitle>
          <CardDescription>Team momentum throughout the match</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="point" />
              <YAxis domain={[-100, 100]} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="momentum"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
                name="Momentum"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Moments</CardTitle>
          <CardDescription>Significant events during the match</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {keyMoments.map((moment, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium">
                  Point {moment.point}
                </div>
                <div>
                  <p className="font-medium">{moment.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Score: {moment.score}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
