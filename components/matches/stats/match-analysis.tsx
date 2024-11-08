"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Match, Player, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerInsights } from "./analysis/player-insights";
import { TeamInsights } from "./analysis/team-insights";

interface MatchAnalysisProps {
  match: Match;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
  players: Player[];
}

export function MatchAnalysis({
  match,
  sets,
  points,
  stats,
  players,
}: MatchAnalysisProps) {

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Match Analysis</CardTitle>
          <CardDescription>
            Comprehensive performance analysis and insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="team" className="space-y-4">
            <TabsList>
              <TabsTrigger value="team">Team Analysis</TabsTrigger>
              <TabsTrigger value="players">Players Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="team">
              <TeamInsights
                match={match}
                sets={sets}
                points={points}
                stats={stats}
              />
            </TabsContent>

            <TabsContent value="players">
              <div className="space-y-8">
                {players.map((player) => (
                  <PlayerInsights
                    key={player.id}
                    player={player}
                    stats={stats}
                    points={points}
                    teamType="home"
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}