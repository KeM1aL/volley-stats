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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Match, PlayerStat, ScorePoint, Set, Player } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { PlayerPosition } from "@/lib/types";
import {
  calculatePositionStats,
  analyzeScoringPatterns,
  analyzeDefensiveVulnerabilities,
  analyzePlayerExploitation,
  generateTacticalInsights,
  type TacticalInsights
} from "@/lib/stats/calculations";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamPerformanceProps {
  match: Match;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
  players: Player[];
}

export function TeamPerformance({
  match,
  sets,
  points,
  stats,
  players,
}: TeamPerformanceProps) {
  const [selectedTab, setSelectedTab] = useState("positions");
  const teamId = match.home_team_id; // For demo, assuming we're analyzing home team

  // Calculate all statistics
  const positionStats = calculatePositionStats(stats, points, teamId);
  const { patterns, rotationStats } = analyzeScoringPatterns(points, sets, teamId);
  const defensiveStats = analyzeDefensiveVulnerabilities(points, teamId);
  const playerExploitation = analyzePlayerExploitation(stats, points, players);
  const tacticalInsights = generateTacticalInsights(positionStats, defensiveStats, rotationStats);

  // Transform data for charts
  const positionPerformanceData = Object.entries(positionStats).map(([position, stats]) => ({
    position,
    scored: stats.pointsScored,
    conceded: stats.pointsConceded,
    attackEfficiency: (stats.attackSuccess / stats.attackAttempts) * 100 || 0,
    receptionRate: (stats.receptionSuccess / stats.receptionAttempts) * 100 || 0,
  }));

  const scoringPatternsData = Object.entries(rotationStats).map(([position, stats]) => ({
    position,
    points: stats.points,
    sequences: stats.sequences,
  }));

  const defensiveData = Object.entries(defensiveStats).map(([position, stats]) => ({
    position,
    conceded: stats.pointsConceded,
    maxStreak: stats.maxConsecutiveLosses,
  }));

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <div className="space-y-6">
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="positions">Position Analysis</TabsTrigger>
          <TabsTrigger value="patterns">Scoring Patterns</TabsTrigger>
          <TabsTrigger value="defense">Defensive Analysis</TabsTrigger>
          <TabsTrigger value="insights">Tactical Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Position Performance Overview</CardTitle>
                <CardDescription>Points scored and conceded by position</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={positionPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="scored" fill={COLORS[0]} name="Points Scored" />
                    <Bar dataKey="conceded" fill={COLORS[1]} name="Points Conceded" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attack & Reception Efficiency</CardTitle>
                <CardDescription>Success rates by position</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={positionPerformanceData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="position" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name="Attack Efficiency"
                      dataKey="attackEfficiency"
                      stroke={COLORS[0]}
                      fill={COLORS[0]}
                      fillOpacity={0.6}
                    />
                    <Radar
                      name="Reception Rate"
                      dataKey="receptionRate"
                      stroke={COLORS[1]}
                      fill={COLORS[1]}
                      fillOpacity={0.6}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Scoring Sequences</CardTitle>
                <CardDescription>Points and successful sequences by rotation</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoringPatternsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="points" fill={COLORS[0]} name="Total Points" />
                    <Bar dataKey="sequences" fill={COLORS[1]} name="Scoring Sequences" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notable Scoring Runs</CardTitle>
                <CardDescription>Sequences of 3+ consecutive points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {patterns.map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">Position {pattern.position}</p>
                        <p className="text-sm text-muted-foreground">
                          Set {pattern.setNumber}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {pattern.length} consecutive points
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="defense">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Defensive Vulnerabilities</CardTitle>
                <CardDescription>Points conceded and longest losing streaks by position</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={defensiveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="position" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="conceded" fill={COLORS[0]} name="Points Conceded" />
                    <Bar dataKey="maxStreak" fill={COLORS[1]} name="Max Consecutive Losses" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attack Pattern Analysis</CardTitle>
                <CardDescription>Opponent's successful attack distributions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(defensiveStats).map(([position, stats]) => (
                    <div key={position} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Position {position}</h4>
                      <div className="space-y-2">
                        <p className="text-sm">
                          Points Conceded: {stats.pointsConceded}
                        </p>
                        <p className="text-sm">
                          Max Consecutive Losses: {stats.maxConsecutiveLosses}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Findings</CardTitle>
                <CardDescription>Strategic analysis and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Strongest Rotation</h4>
                      <Badge variant="default">
                        Position {tacticalInsights.strongestRotation}
                      </Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Weakest Rotation</h4>
                      <Badge variant="destructive">
                        Position {tacticalInsights.weakestRotation}
                      </Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Best Attack Position</h4>
                      <Badge variant="default">
                        Position {tacticalInsights.bestAttackPosition}
                      </Badge>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Most Vulnerable Position</h4>
                      <Badge variant="destructive">
                        Position {tacticalInsights.mostVulnerablePosition}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Tactical Recommendations</h4>
                    <ul className="space-y-2">
                      {tacticalInsights.recommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm">
                          • {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}