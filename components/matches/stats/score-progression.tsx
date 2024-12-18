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
import { Match, ScorePoint, Set } from "@/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ScoreProgressionProps {
  match: Match;
  points: ScorePoint[];
  sets: Set[];
}

export function ScoreProgression({ match, sets, points }: ScoreProgressionProps) {
  const [selectedSet, setSelectedSet] = useState<string>("all");

  const progressionData = points
    .filter((p) => selectedSet === "all" || p.set_id === selectedSet)
    .map((point, index) => ({
      point: index + 1,
      home: point.home_score,
      away: point.away_score,
      difference: point.home_score - point.away_score,
    }));

  return (
    <div className="space-y-6">
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
                        ${index === sets.length - 1 ? "rounded-l-none" : ""}
                        ${
                          index >= 0 && index < sets.length - 1
                            ? "rounded-none border-x-0"
                            : ""
                        }
                      `}
          >
            Set {set.set_number}
          </Button>
        ))}
      </div>
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
    </div>
  );
}
