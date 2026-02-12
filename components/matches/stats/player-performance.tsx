"use client";

import React, { useState, useRef, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { PlayerStat, Team, TeamMember, Set, Match } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatResult, StatType, PlayerPosition } from "@/lib/enums";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { getPlayerSetStats } from "@/lib/stats/calculations";
import { PdfExportHandle } from "@/lib/pdf/types";

interface PlayerPositionStats
  extends Record<
    StatType,
    Record<PlayerPosition | "all", Record<StatResult | "all", number>>
  > {
  favSpikePosition: PlayerPosition | null;
  worstSpikePosition: PlayerPosition | null;
  favReceptionPosition: PlayerPosition | null;
  worstReceptionPosition: PlayerPosition | null;
}

interface PlayerPerformanceProps {
  match: Match;
  managedTeam: Team;
  opponentTeam: Team;
  players: TeamMember[];
  stats: PlayerStat[];
  sets: Set[];
  isPdfGenerating?: boolean;
}

export const variants = {
  [StatResult.SUCCESS]: "text-green-700",
  [StatResult.ERROR]: "text-red-700",
  [StatResult.BAD]: "text-yellow-600",
  [StatResult.GOOD]: "text-blue-700",
};

const PlayerPerformance = React.forwardRef<
  PdfExportHandle,
  PlayerPerformanceProps
>(({ match, managedTeam, opponentTeam, players, stats, sets, isPdfGenerating }, ref) => {
  const t = useTranslations("matches");
  const tStats = useTranslations("stats");
  const [selectedSet, setSelectedSet] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState("overview");
  const playerPerformanceRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
      let currentYOffset = initialYOffset;
      const margin = 20;
      const imgWidth = 595 - 2 * margin;
      let isFirstPage = true;

      const setsToIterate = [null, ...allSets.map((s) => s.id)];
      const tabsToIterate = ["overview", "details", "positions"];

      for (const tab of tabsToIterate) {
        setSelectedTab(tab);
        await new Promise((resolve) => setTimeout(resolve, 300));

        for (const setId of setsToIterate) {
          setSelectedSet(setId === null ? "all" : setId);
          await new Promise((resolve) => setTimeout(resolve, 300));

          const subTitle =
            setId === null
              ? t("stats.allSetsOverview")
              : `${t("stats.setLabel")} ${
                  allSets.find((s) => s.id === setId)?.set_number || ""
                } ${t("stats.breakdown")}`;

          // Only add page after first content
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;
          currentYOffset = margin;

          doc.setFontSize(16);
          doc.text(`${tabTitle} - ${subTitle}`, margin, currentYOffset);
          currentYOffset += 30;

          if (playerPerformanceRef.current) {
            const canvas = await html2canvas(playerPerformanceRef.current, {
              scale: 1.5,
              useCORS: true,
              logging: false,
            });
            const imgData = canvas.toDataURL("image/jpeg", 0.6);
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
              `Player Performance content element not found for PDF export.`
            );
          }
        }
      }
      return currentYOffset;
    },
  }));

  const getPlayerSetPositionStats = (
    playerId: string,
    setId?: string
  ): PlayerPositionStats => {
    const filteredSets = sets.filter((set) =>
      setId ? set.id === setId : true
    );
    const filteredStats = stats.filter(
      (stat) =>
        stat.player_id === playerId && (setId ? stat.set_id === setId : true)
    );
    const playerStats: PlayerPositionStats = {} as PlayerPositionStats;
    Object.values(StatType).forEach((type) => {
      const statPosition: Record<
        PlayerPosition | "all",
        Record<StatResult | "all", number>
      > = {} as Record<
        PlayerPosition | "all",
        Record<StatResult | "all", number>
      >;
      Object.values(PlayerPosition).forEach((position) => {
        const statResult: Record<StatResult | "all", number> = {} as Record<
          StatResult | "all",
          number
        >;
        Object.values(StatResult).forEach((result) => {
          statResult[result] = filteredStats.filter(
            (s) =>
              s.stat_type === type &&
              s.position === position &&
              s.result === result
          ).length;
        });

        statResult["all"] = filteredStats.filter(
          (s) => s.stat_type === type && s.position === position
        ).length;

        statPosition[position] = statResult;
      });
      Object.values(StatType).forEach((type) => {
        const statResult: Record<StatResult | "all", number> = {} as Record<
          StatResult | "all",
          number
        >;
        Object.values(StatResult).forEach((result) => {
          statResult[result] = filteredStats.filter(
            (s) => s.stat_type === type && s.result === result
          ).length;
        });

        statResult["all"] = filteredStats.filter(
          (s) => s.stat_type === type
        ).length;

        statPosition["all"] = statResult;
      });

      playerStats[type] = statPosition;
    });

    let spikeBestRate = 0;
    let spikeWorstRate = 100;
    let favPosition: PlayerPosition | null = null;
    let worstPosition: PlayerPosition | null = null;
    Object.entries(playerStats[StatType.SPIKE]).forEach(([position, stats]) => {
      if (stats["all"] === 0) return;
      let spikeRate = stats[StatResult.SUCCESS] / stats["all"];
      if (spikeRate > spikeBestRate) {
        spikeBestRate = spikeRate;
        favPosition = position as PlayerPosition;
      } else if (spikeRate < spikeWorstRate) {
        spikeWorstRate = spikeRate;
        worstPosition = position as PlayerPosition;
      }
    });
    playerStats.favSpikePosition = favPosition!;
    playerStats.worstSpikePosition = worstPosition!;

    let receptionBestRate = 0;
    let receptionWorstRate = 100;
    let favPositionReception: PlayerPosition | null = null;
    let worstPositionReception: PlayerPosition | null = null;
    Object.entries(playerStats[StatType.RECEPTION]).forEach(
      ([position, stats]) => {
        if (stats["all"] === 0) return;
        let receptionRate = stats[StatResult.SUCCESS] / stats["all"];
        if (receptionRate > receptionBestRate) {
          receptionBestRate = receptionRate;
          favPositionReception = position as PlayerPosition;
        } else if (receptionRate < receptionWorstRate) {
          receptionWorstRate = receptionRate;
          worstPositionReception = position as PlayerPosition;
        }
      }
    );
    playerStats.favReceptionPosition = favPositionReception!;
    playerStats.worstReceptionPosition = worstPositionReception!;
    return playerStats;
  };

  const getPlayerPerformanceData = () => {
    return players.map((player) => {
      const playerStats = getPlayerSetStats(
        match,
        stats,
        sets,
        managedTeam!,
        opponentTeam!,
        player.id,
        selectedSet === "all" ? undefined : selectedSet
      );
      return {
        name: player.name,
        attacks: playerStats[StatType.SPIKE][StatResult.SUCCESS],
        serves: playerStats[StatType.SERVE][StatResult.SUCCESS],
        blocks: playerStats[StatType.BLOCK][StatResult.SUCCESS],
        receptions: playerStats[StatType.RECEPTION][StatResult.SUCCESS],
        defenses: playerStats[StatType.DEFENSE][StatResult.SUCCESS],
      };
    });
  };

  const getPlayerRadarData = (playerId: string) => {
    const playerStats = getPlayerSetStats(
      match,
      stats,
      sets,
      managedTeam!,
      opponentTeam!,
      playerId,
      selectedSet === "all" ? undefined : selectedSet
    );
    return [
      {
        subject: t("stats.attacks"),
        A:
          (playerStats[StatType.SPIKE][StatResult.SUCCESS] /
            (playerStats[StatType.SPIKE]["all"] || 1)) *
          100,
        fullMark: 100,
      },
      {
        subject: t("stats.serves"),
        A:
          (playerStats[StatType.SERVE][StatResult.SUCCESS] /
            (playerStats[StatType.SERVE]["all"] || 1)) *
          100,
        fullMark: 100,
      },
      {
        subject: t("stats.blocks"),
        A:
          (playerStats[StatType.BLOCK][StatResult.SUCCESS] /
            (playerStats[StatType.BLOCK]["all"] || 1)) *
          100,
        fullMark: 10,
      },
      {
        subject: t("stats.reception"),
        A:
          (playerStats[StatType.RECEPTION][StatResult.SUCCESS] /
            (playerStats[StatType.RECEPTION]["all"] || 1)) *
          100,
        fullMark: 100,
      },
      {
        subject: t("stats.defense"),
        A:
          (playerStats[StatType.DEFENSE][StatResult.SUCCESS] /
            (playerStats[StatType.DEFENSE]["all"] || 1)) *
          100,
        fullMark: 100,
      },
    ];
  };

  const statTypeLabel: Record<StatType, string> = {
    [StatType.SPIKE]: t("stats.spike"),
    [StatType.SERVE]: t("stats.serve"),
    [StatType.BLOCK]: t("stats.block"),
    [StatType.RECEPTION]: t("stats.reception"),
    [StatType.DEFENSE]: t("stats.defense"),
  };

  return (
    <Card ref={playerPerformanceRef} id="players-section-content">
      <CardHeader>
        <CardTitle>{t("stats.playerPerformance")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="overview">{t("stats.overview")}</TabsTrigger>
            <TabsTrigger value="details">{t("stats.detailedStats")}</TabsTrigger>
            <TabsTrigger value="positions">{t("stats.positionsStats")}</TabsTrigger>
          </TabsList>
          <div className="space-y-4">
            <div className="inline-flex pdf-hide">
              <Button
                variant={selectedSet === "all" ? "default" : "outline"}
                onClick={() => setSelectedSet("all")}
                className="rounded-r-none"
              >
                {t("stats.allSetsOverview")}
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
                  {t("stats.setLabel")} {set.set_number}
                </Button>
              ))}
            </div>
            <TabsContent value="overview">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("stats.overallPerformance")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getPlayerPerformanceData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="attacks"
                            fill="hsl(var(--chart-1))"
                            name={t("stats.attacks")}
                          />
                          <Bar
                            dataKey="serves"
                            fill="hsl(var(--chart-2))"
                            name={t("stats.serves")}
                          />
                          <Bar
                            dataKey="blocks"
                            fill="hsl(var(--chart-3))"
                            name={t("stats.blocks")}
                          />
                          <Bar
                            dataKey="receptions"
                            fill="hsl(var(--chart-4))"
                            name={t("stats.receptions")}
                          />
                          <Bar
                            dataKey="defenses"
                            fill="hsl(var(--chart-5))"
                            name={t("stats.defenses")}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-3 gap-4">
                  {players.map((player) => (
                    <Card key={player.id}>
                      <CardHeader>
                        <CardTitle>{player.name} {t("stats.performanceRadar")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={isPdfGenerating ? "h-[200px]" : "h-[300px]"}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={getPlayerRadarData(player.id)}>
                              <PolarGrid />
                              <PolarAngleAxis dataKey="subject" />
                              <PolarRadiusAxis />
                              <Radar
                                name={player.name}
                                dataKey="A"
                                stroke="hsl(var(--chart-1))"
                                fill="hsl(var(--chart-1))"
                                fillOpacity={0.6}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details">
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tStats("playerPerformance.tableHeaders.player")}</TableHead>
                      {Object.values(StatType).map((type) => (
                        <TableHead key={type}>
                          {statTypeLabel[type]} (
                          <span className={variants[StatResult.SUCCESS]}>
                            {tStats("abbreviations.success")}
                          </span>
                          /<span className={variants[StatResult.GOOD]}>{tStats("abbreviations.good")}</span>/
                          <span className={variants[StatResult.BAD]}>{tStats("abbreviations.bad")}</span>/
                          <span className={variants[StatResult.ERROR]}>{tStats("abbreviations.error")}</span>)
                        </TableHead>
                      ))}
                      <TableHead>{tStats("playerPerformance.tableHeaders.pointParticipation")}</TableHead>
                      <TableHead>{tStats("playerPerformance.tableHeaders.errorParticipation")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => {
                      const playerStats = getPlayerSetStats(
                        match,
                        stats,
                        sets,
                        managedTeam!,
                        opponentTeam!,
                        player.id,
                        selectedSet === "all" ? undefined : selectedSet
                      );

                      return (
                        <TableRow
                          key={player.id}
                          className={
                            index % 2 === 0 ? "bg-background" : "bg-muted/50"
                          }
                        >
                          <TableCell className="font-medium">
                            {player.name}
                          </TableCell>
                          {Object.values(StatType).map((type) => (
                            <TableCell key={type}>
                              <span className={variants[StatResult.SUCCESS]}>
                                {playerStats[type][StatResult.SUCCESS]}
                              </span>
                              /
                              <span className={variants[StatResult.GOOD]}>
                                {playerStats[type][StatResult.GOOD]}
                              </span>
                              /
                              <span className={variants[StatResult.BAD]}>
                                {playerStats[type][StatResult.BAD]}
                              </span>
                              /
                              <span className={variants[StatResult.ERROR]}>
                                {playerStats[type][StatResult.ERROR]}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell>
                            <Badge
                              variant={
                                playerStats.positiveImpact > 10
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {playerStats.positiveImpact.toFixed(2)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                playerStats.negativeImpact > 10
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {playerStats.negativeImpact.toFixed(2)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="positions">
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead colSpan={8} className="text-center border-r-2">
                        {t("stats.spikes")}
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>{tStats("playerPerformance.tableHeaders.player")}</TableHead>
                      {Object.values(PlayerPosition).map((position) => (
                        <TableHead key={`${position}-spike`}>
                          {position.toUpperCase()}(
                          <span className={variants[StatResult.SUCCESS]}>
                            {tStats("abbreviations.success")}
                          </span>
                          /<span className={variants[StatResult.GOOD]}>{tStats("abbreviations.good")}</span>/
                          <span className={variants[StatResult.BAD]}>{tStats("abbreviations.bad")}</span>/
                          <span className={variants[StatResult.ERROR]}>{tStats("abbreviations.error")}</span>)
                        </TableHead>
                      ))}
                      <TableHead>{tStats("playerPerformance.tableHeaders.favoritePosition")}</TableHead>
                      <TableHead className="border-r-2">
                        {tStats("playerPerformance.tableHeaders.worstPosition")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => {
                      const stats = getPlayerSetPositionStats(
                        player.id,
                        selectedSet === "all" ? undefined : selectedSet
                      );

                      return (
                        <TableRow
                          key={player.id}
                          className={
                            index % 2 === 0 ? "bg-background" : "bg-muted/50"
                          }
                        >
                          <TableCell className="font-medium">
                            {player.name}
                          </TableCell>
                          {Object.values(PlayerPosition).map((position) => (
                            <TableCell key={`${position}-spike`}>
                              <span className={variants[StatResult.SUCCESS]}>
                                {
                                  stats[StatType.SPIKE][position][
                                    StatResult.SUCCESS
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.GOOD]}>
                                {
                                  stats[StatType.SPIKE][position][
                                    StatResult.GOOD
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.BAD]}>
                                {
                                  stats[StatType.SPIKE][position][
                                    StatResult.BAD
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.ERROR]}>
                                {
                                  stats[StatType.SPIKE][position][
                                    StatResult.ERROR
                                  ]
                                }
                              </span>
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {stats.favSpikePosition && (
                              <Badge variant="default">
                                {stats.favSpikePosition.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="border-r-2 text-center">
                            {stats.worstSpikePosition && (
                              <Badge variant="destructive">
                                {stats.worstSpikePosition.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead colSpan={8} className="text-center">
                        {t("stats.receptions")}
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>{tStats("playerPerformance.tableHeaders.player")}</TableHead>
                      {Object.values(PlayerPosition).map((position) => (
                        <TableHead key={`${position}-reception`}>
                          {position.toUpperCase()}(
                          <span className={variants[StatResult.SUCCESS]}>
                            {tStats("abbreviations.success")}
                          </span>
                          /<span className={variants[StatResult.GOOD]}>{tStats("abbreviations.good")}</span>/
                          <span className={variants[StatResult.BAD]}>{tStats("abbreviations.bad")}</span>/
                          <span className={variants[StatResult.ERROR]}>{tStats("abbreviations.error")}</span>)
                        </TableHead>
                      ))}
                      <TableHead>{tStats("playerPerformance.tableHeaders.favoritePosition")}</TableHead>
                      <TableHead>{tStats("playerPerformance.tableHeaders.worstPosition")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => {
                      const stats = getPlayerSetPositionStats(
                        player.id,
                        selectedSet === "all" ? undefined : selectedSet
                      );

                      return (
                        <TableRow
                          key={player.id}
                          className={
                            index % 2 === 0 ? "bg-background" : "bg-muted/50"
                          }
                        >
                          <TableCell className="font-medium">
                            {player.name}
                          </TableCell>
                          {Object.values(PlayerPosition).map((position) => (
                            <TableCell key={`${position}-reception`}>
                              <span className={variants[StatResult.SUCCESS]}>
                                {
                                  stats[StatType.RECEPTION][position][
                                    StatResult.SUCCESS
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.GOOD]}>
                                {
                                  stats[StatType.RECEPTION][position][
                                    StatResult.GOOD
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.BAD]}>
                                {
                                  stats[StatType.RECEPTION][position][
                                    StatResult.BAD
                                  ]
                                }
                              </span>
                              /
                              <span className={variants[StatResult.ERROR]}>
                                {
                                  stats[StatType.RECEPTION][position][
                                    StatResult.ERROR
                                  ]
                                }
                              </span>
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {stats.favReceptionPosition && (
                              <Badge variant="default">
                                {stats.favReceptionPosition.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {stats.worstReceptionPosition && (
                              <Badge variant="destructive">
                                {stats.worstReceptionPosition.toUpperCase()}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
});

PlayerPerformance.displayName = "PlayerPerformance";

export { PlayerPerformance };
