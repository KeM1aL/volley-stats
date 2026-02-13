"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { Match, Set, ScorePoint, TeamMember } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

type StatisticsDialogProps = {
  match: Match | null;
  onClose: () => void;
};

export function StatisticsDialog({ match, onClose }: StatisticsDialogProps) {
  const t = useTranslations("matches");
  const [sets, setSets] = useState<Set[]>([]);
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!match) return;

      setIsLoading(true);
      const supabase = createClient();

      const [setsResponse, pointsResponse, playersResponse] = await Promise.all([
        supabase.from("sets").select("*").eq("match_id", match.id),
        supabase.from("score_points").select("*").eq("match_id", match.id),
        supabase
          .from("team_members")
          .select("*")
          .in("team_id", [match.home_team_id, match.away_team_id]),
      ]);

      if (setsResponse.error) throw setsResponse.error;
      if (pointsResponse.error) throw pointsResponse.error;
      if (playersResponse.error) throw playersResponse.error;

      setSets(setsResponse.data);
      setPoints(pointsResponse.data);
      setPlayers(playersResponse.data);
      setIsLoading(false);
    };

    loadData();
  }, [match]);

  if (!match) return null;

  const pointsByType = points.reduce((acc, point) => {
    acc[point.point_type] = (acc[point.point_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pointTypeData = Object.entries(pointsByType).map(([type, count]) => ({
    type: type.replace("_", " "),
    count,
  }));

  const playerStats = players.map((player) => {
    const playerPoints = points.filter((p) => p.player_id === player.id);
    return {
      name: player.name,
      points: playerPoints.length,
      serves: playerPoints.filter((p) => p.point_type === "serve").length,
      spikes: playerPoints.filter((p) => p.point_type === "spike").length,
      blocks: playerPoints.filter((p) => p.point_type === "block").length,
    };
  });

  return (
    <Dialog open={!!match} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("stats.title")}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("stats.overview")}</TabsTrigger>
              <TabsTrigger value="sets">{t("stats.sets")}</TabsTrigger>
              <TabsTrigger value="players">{t("stats.players")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("stats.pointsByType")}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pointTypeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--primary))"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sets">
              <div className="grid gap-6">
                {sets.map((set) => (
                  <Card key={set.id}>
                    <CardHeader>
                      <CardTitle>Set {set.set_number}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg">
                        {set.home_score} - {set.away_score}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="players">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("stats.playerPerformance")}</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={playerStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="serves" stackId="a" fill="#8884d8" />
                        <Bar dataKey="spikes" stackId="a" fill="#82ca9d" />
                        <Bar dataKey="blocks" stackId="a" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}