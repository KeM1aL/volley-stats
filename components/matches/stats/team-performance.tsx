"use client";

import React, { useState, useRef, useImperativeHandle, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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
import {
  Match,
  PlayerStat,
  ScorePoint,
  Set,
  TeamMember,
  Team,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { PlayerPosition } from "@/lib/enums";
import {
  calculatePositionStats,
  analyzeScoringPatterns,
  analyzeDefensiveVulnerabilities,
  analyzePlayerExploitation,
  generateTacticalInsights,
  type TacticalInsights,
  analyzeStreaks,
} from "@/lib/stats/calculations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ratio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PdfExportHandle } from "@/lib/pdf/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface TeamPerformanceProps {
  match: Match;
  managedTeam: Team;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
  players: TeamMember[];
  isPdfGenerating?: boolean;
}

const TeamPerformance = React.forwardRef<
  PdfExportHandle,
  TeamPerformanceProps
>(
  (
    { match, sets, points, managedTeam, stats, players, isPdfGenerating },
    ref
  ) => {
    const [selectedPlayer, setSelectedPlayer] = useState<string>(players[0].id);
    const [selectedSet, setSelectedSet] = useState<string>("all");
    const [selectedTab, setSelectedTab] = useState("positions");
    const teamPerformanceRef = useRef<HTMLDivElement>(null);
    const teamId = managedTeam.id;
    const [pdfRenderTrigger, setPdfRenderTrigger] = useState(0);

    const waitForContentToRender = () => {
      return new Promise((resolve) => {
        const checkContent = () => {
          if (teamPerformanceRef.current) {
            resolve(null);
          } else {
            setTimeout(checkContent, 100);
          }
        };
        checkContent();
      });
    };

    useImperativeHandle(ref, () => ({
      generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
        let currentYOffset = initialYOffset;
        const margin = 20;
        const imgWidth = 595 - 2 * margin;
        const tabIds = ["positions", "streaks", "patterns", "defense", "insights"];
        const tabNames = {
          positions: "Position Analysis",
          streaks: "Streak Analysis",
          patterns: "Scoring Patterns",
          defense: "Defensive Analysis",
          insights: "Tactical Insights",
        };

        const setsToIterate = [null, ...allSets.map((s) => s.id)];

        for (const tabId of tabIds) {
          setSelectedTab(tabId);
          for (const setId of setsToIterate) {
            setSelectedSet(setId === null ? "all" : setId);
            setPdfRenderTrigger((prev) => prev + 1);

            await waitForContentToRender();

            const subTitle =
              setId === null
                ? "All Sets Overview"
                : `Set ${
                    allSets.find((s) => s.id === setId)?.set_number || ""
                  } Breakdown`;

            doc.addPage();
            currentYOffset = margin;
            doc.setFontSize(16);
            doc.text(
              `${tabNames[tabId as keyof typeof tabNames]} - ${subTitle}`,
              margin,
              currentYOffset
            );
            currentYOffset += 20;

            if (teamPerformanceRef.current) {
              const canvas = await html2canvas(teamPerformanceRef.current, {
                scale: 2,
                useCORS: true,
              });
              const imgData = canvas.toDataURL("image/jpeg", 0.9);
              const imgHeight = (canvas.height * imgWidth) / canvas.width;

              if (
                currentYOffset + imgHeight >
                doc.internal.pageSize.height - margin
              ) {
                doc.addPage();
                currentYOffset = margin;
              }
              doc.addImage(
                imgData,
                "JPEG",
                margin,
                currentYOffset,
                imgWidth,
                imgHeight
              );
              currentYOffset += imgHeight + margin;
            } else {
              console.warn(
                `Team Performance content element not found for PDF export.`
              );
            }
          }
        }
        return currentYOffset;
      },
    }));

    // Calculate all statistics
    const positionStats = calculatePositionStats(
      stats,
      points,
      teamId,
      selectedPlayer ? selectedPlayer : players[0].id,
      selectedSet === "all" ? undefined : selectedSet
    );
    const { patterns, rotationStats } = analyzeScoringPatterns(
      points,
      sets,
      teamId,
      selectedPlayer ? selectedPlayer : players[0].id,
      selectedSet === "all" ? undefined : selectedSet
    );
    const defensiveStats = analyzeDefensiveVulnerabilities(
      points,
      teamId,
      selectedPlayer ? selectedPlayer : players[0].id,
      selectedSet === "all" ? undefined : selectedSet
    );
    const tacticalInsights = generateTacticalInsights(
      positionStats,
      defensiveStats,
      rotationStats
    );

    // Analyze streaks
    const streakAnalysis = analyzeStreaks(
      points,
      sets,
      teamId,
      selectedPlayer ? selectedPlayer : players[0].id,
      selectedSet === "all" ? undefined : selectedSet
    );

    const streakDistributionData = Object.entries(
      streakAnalysis.winning.distribution
    ).map(([position, count]) => ({
      position,
      winning: count,
      losing: streakAnalysis.losing.distribution[position as PlayerPosition],
    }));

    // Transform data for charts
    const positionPerformanceData = Object.entries(positionStats).map(
      ([position, stats]) => ({
        position,
        scored: stats.pointsScored,
        conceded: stats.pointsConceded,
        distribution: Object.entries(stats.attackDistribution).map(
          ([spikePosition, spikes]) => ({
            spikePosition,
            ratio: (spikes / stats.attackSuccess) * 100 || 0,
          })
        ),
      })
    );

    const scoringPatternsData = Object.entries(rotationStats).map(
      ([position, stats]) => ({
        position,
        points: stats.points,
        sequences: stats.sequences,
      })
    );

    const defensiveData = Object.entries(defensiveStats).map(
      ([position, stats]) => ({
        position,
        conceded: stats.pointsConceded,
        maxStreak: stats.maxConsecutiveLosses,
      })
    );

    const COLORS = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
    ];

    return (
      <Card ref={teamPerformanceRef} id="team-section-content">
        {isPdfGenerating && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <p className="mb-2 text-lg font-semibold">Generating PDF...</p>
              <p className="text-sm text-gray-500">
                Please wait while we generate the PDF report.
              </p>
            </div>
          </div>
        )}
        <CardHeader>
          <CardTitle>Player Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="positions">Position Analysis</TabsTrigger>
              <TabsTrigger value="streaks">Streak Analysis</TabsTrigger>
              <TabsTrigger value="patterns">Scoring Patterns</TabsTrigger>
              <TabsTrigger value="defense">Defensive Analysis</TabsTrigger>
              <TabsTrigger value="insights">Tactical Insights</TabsTrigger>
            </TabsList>
            <div className="space-y-4">
              <div className="inline-flex space-x-2">
                <Select
                  value={selectedPlayer || undefined}
                  onValueChange={setSelectedPlayer}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select player" />
                  </SelectTrigger>
                  <SelectContent defaultValue={players[0].id}>
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        #{player.number} {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
              </div>
              <TabsContent value="positions">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Position Performance Overview</CardTitle>
                      <CardDescription>
                        Points scored and conceded by position
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={positionPerformanceData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="position" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="scored"
                            fill={COLORS[0]}
                            name="Points Scored"
                          />
                          <Bar
                            dataKey="conceded"
                            fill={COLORS[1]}
                            name="Points Conceded"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Attack distribution</CardTitle>
                      <CardDescription>
                        Success spiked by player position
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[800px] grid grid-cols-3 gap-4">
                      {positionPerformanceData.map((data, i) => (
                        <ResponsiveContainer key={i} width="100%" height="100%">
                          <RadarChart data={data.distribution}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="spikePosition" />
                            <PolarRadiusAxis domain={[0, 100]} />
                            <Radar
                              name={`Player ${data.position.toUpperCase()}`}
                              dataKey="ratio"
                              stroke={COLORS[0]}
                              fill={COLORS[0]}
                              fillOpacity={0.6}
                            />
                            <Legend />
                          </RadarChart>
                        </ResponsiveContainer>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="streaks">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Streak Distribution</CardTitle>
                      <CardDescription>
                        Winning and losing streaks by position
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={streakDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="position" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="winning"
                            fill={COLORS[0]}
                            name="Winning Streaks"
                          />
                          <Bar
                            dataKey="losing"
                            fill={COLORS[1]}
                            name="Losing Streaks"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Winning Streak Analysis</CardTitle>
                        <CardDescription>
                          Average Length:{" "}
                          {streakAnalysis.winning.averageLength.toFixed(1)}{" "}
                          points
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {streakAnalysis.winning.streaks
                            .slice(0, 5)
                            .map((streak, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-4 border rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">
                                    Position {streak.position}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Set {streak.setNumber}
                                  </p>
                                </div>
                                <Badge variant="default">
                                  {streak.length} points
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Losing Streak Analysis</CardTitle>
                        <CardDescription>
                          Average Length:{" "}
                          {streakAnalysis.losing.averageLength.toFixed(1)}{" "}
                          points
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {streakAnalysis.losing.streaks
                            .slice(0, 5)
                            .map((streak, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-4 border rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">
                                    Position {streak.position}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Set {streak.setNumber}
                                  </p>
                                </div>
                                <Badge variant="destructive">
                                  {streak.length} points
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="patterns">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Scoring Sequences</CardTitle>
                      <CardDescription>
                        Points and successful sequences by rotation
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoringPatternsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="position" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="points"
                            fill={COLORS[0]}
                            name="Total Points"
                          />
                          <Bar
                            dataKey="sequences"
                            fill={COLORS[1]}
                            name="Scoring Sequences"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Notable Scoring Runs</CardTitle>
                      <CardDescription>
                        Sequences of 3+ consecutive points
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {patterns.map((pattern, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">
                                Position {pattern.position}
                              </p>
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
                      <CardDescription>
                        Points conceded and longest losing streaks by position
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={defensiveData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="position" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="conceded"
                            fill={COLORS[0]}
                            name="Points Conceded"
                          />
                          <Bar
                            dataKey="maxStreak"
                            fill={COLORS[1]}
                            name="Max Consecutive Losses"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Attack Pattern Analysis</CardTitle>
                      <CardDescription>
                        Opponent's successful attack distributions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(defensiveStats).map(
                          ([position, stats]) => (
                            <div
                              key={position}
                              className="p-4 border rounded-lg"
                            >
                              <h4 className="font-medium mb-2">
                                Position {position}
                              </h4>
                              <div className="space-y-2">
                                <p className="text-sm">
                                  Points Conceded: {stats.pointsConceded}
                                </p>
                                <p className="text-sm">
                                  Max Consecutive Losses:{" "}
                                  {stats.maxConsecutiveLosses}
                                </p>
                              </div>
                            </div>
                          )
                        )}
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
                      <CardDescription>
                        Strategic analysis and recommendations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-medium mb-2">
                              Strongest Rotation
                            </h4>
                            <Badge variant="default">
                              Position {tacticalInsights.strongestRotation}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-medium mb-2">
                              Weakest Rotation
                            </h4>
                            <Badge variant="destructive">
                              Position {tacticalInsights.weakestRotation}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-medium mb-2">
                              Best Attack Position
                            </h4>
                            <Badge variant="default">
                              Position {tacticalInsights.bestAttackPosition}
                            </Badge>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-medium mb-2">
                              Most Vulnerable Position
                            </h4>
                            <Badge variant="destructive">
                              Position {tacticalInsights.mostVulnerablePosition}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium">
                            Tactical Recommendations
                          </h4>
                          <ul className="space-y-2">
                            {tacticalInsights.recommendations.map(
                              (recommendation, index) => (
                                <li key={index} className="text-sm">
                                  • {recommendation}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    );
  }
);

TeamPerformance.displayName = "TeamPerformance";

export { TeamPerformance };