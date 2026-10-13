"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
} from "recharts";
import { Match, ScorePoint, Set } from "@/lib/types";
import { SetSelector } from "./set-selector";

interface ScoreProgressionProps {
  match: Match;
  points: ScorePoint[];
  sets: Set[];
}

function ScoreProgression({ sets, points }: ScoreProgressionProps) {
  const t = useTranslations("matches");
  const [selectedSet, setSelectedSet] = useState<string | null>(null);

  const progressionData = points
    .filter((p) => selectedSet === null || p.set_id === selectedSet)
    .map((point, index) => ({
      point: index + 1,
      home: point.home_score,
      away: point.away_score,
      difference: point.home_score - point.away_score,
    }));
  progressionData.unshift({
    point: 0,
    home: 0,
    away: 0,
    difference: 0,
  });

  return (
    <div id="scores-section-content" className="space-y-6">
      <SetSelector sets={sets} selectedSetId={selectedSet} onSelectSet={setSelectedSet} />
      <Card>
        <CardHeader>
          <CardTitle>{t("stats.scoreProgression")}</CardTitle>
          <CardDescription>{t("stats.scoreProgressionDesc")}</CardDescription>
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
          <CardTitle>{t("stats.scoreDifference")}</CardTitle>
          <CardDescription>{t("stats.scoreDifferenceDesc")}</CardDescription>
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

ScoreProgression.displayName = "ScoreProgression";

export { ScoreProgression };
