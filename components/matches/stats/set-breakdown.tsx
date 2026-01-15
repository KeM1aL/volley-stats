"use client";

import React, { useState, useRef, useImperativeHandle } from "react";
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
} from "recharts";
import { Match, ScorePoint, Set, Team } from "@/lib/types";
import { PdfExportHandle } from "@/lib/pdf/types";

interface SetBreakdownProps {
  match: Match;
  managedTeam: Team;
  opponentTeam: Team;
  sets: Set[];
  points: ScorePoint[];
  isPdfGenerating?: boolean;
}

const SetBreakdown = React.forwardRef<PdfExportHandle, SetBreakdownProps>(
  ({ match, sets, points, managedTeam, opponentTeam, isPdfGenerating }, ref) => {
    const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
    const setBreakdownRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
        let currentYOffset = initialYOffset;
        const margin = 20;
        const imgWidth = 595 - 2 * margin;

        // Don't add page here - the orchestrator handles page management
        currentYOffset = margin;
        doc.setFontSize(16);
        doc.text(`${tabTitle} - All Sets Overview`, margin, currentYOffset);
        currentYOffset += 30;

        await new Promise((resolve) => setTimeout(resolve, 300));

        if (setBreakdownRef.current) {
          const canvas = await html2canvas(setBreakdownRef.current, {
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
            `Set Breakdown content element not found for PDF export.`
          );
        }

        return currentYOffset;
      },
    }));

    const currentSets = selectedSetId
      ? sets.filter((set) => set.id === selectedSetId)
      : sets;
    const currentPoints = selectedSetId
      ? points.filter((point) => point.set_id === selectedSetId)
      : points;

    const setData = currentSets.map((set) => {
      const setPoints = currentPoints.filter((p) => p.set_id === set.id);

      return {
        set: `Set ${set.set_number}`,
        homeScore: set.home_score,
        awayScore: set.away_score,
        points: {
          serves: setPoints.filter(
            (p) =>
              p.point_type === "serve" && p.scoring_team_id === managedTeam.id
          ).length,
          spikes: setPoints.filter(
            (p) =>
              p.point_type === "spike" && p.scoring_team_id === managedTeam.id
          ).length,
          blocks: setPoints.filter(
            (p) =>
              p.point_type === "block" && p.scoring_team_id === managedTeam.id
          ).length,
          errors: setPoints.filter(
            (p) =>
              p.point_type === "unknown" && p.scoring_team_id === managedTeam.id
          ).length,
        },
        errors: {
          serves: setPoints.filter(
            (p) =>
              p.point_type === "serve" && p.scoring_team_id !== managedTeam.id
          ).length,
          spikes: setPoints.filter(
            (p) =>
              p.point_type === "spike" && p.scoring_team_id !== managedTeam.id
          ).length,
          blocks: setPoints.filter(
            (p) =>
              p.point_type === "block" && p.scoring_team_id !== managedTeam.id
          ).length,
          points: setPoints.filter(
            (p) =>
              p.point_type === "unknown" && p.scoring_team_id !== managedTeam.id
          ).length,
        },
      };
    });

    return (
      <div
        ref={setBreakdownRef}
        id="sets-section-content"
        className="space-y-6"
      >
        <div className="flex flex-row items-center justify-between gap-6">
          {currentSets.map((set) => (
            <Card key={set.id} className="basis-1/3">
              <CardHeader>
                <CardTitle>Set {set.set_number}</CardTitle>
                <CardDescription>
                  Score: {set.home_score} - {set.away_score}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>
                    Duration:{" "}
                    {Math.round(set.home_score + set.away_score * 0.75)} minutes
                  </p>
                  <p>Points Played: {set.home_score + set.away_score}</p>
                  <p>Point Distribution:</p>
                  <div className="pl-4 space-y-1 text-sm">
                    <p>
                      Serves:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "serve" &&
                            p.scoring_team_id === managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Spikes:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "spike" &&
                            p.scoring_team_id === managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Blocks:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "block" &&
                            p.scoring_team_id === managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Opponent Errors:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "unknown" &&
                            p.scoring_team_id === managedTeam.id
                        ).length
                      }
                    </p>
                  </div>
                  <p>Error Distribution:</p>
                  <div className="pl-4 space-y-1 text-sm">
                    <p>
                      Serves:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "serve" &&
                            p.scoring_team_id !== managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Spikes:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "spike" &&
                            p.scoring_team_id !== managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Blocks:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "block" &&
                            p.scoring_team_id !== managedTeam.id
                        ).length
                      }
                    </p>
                    <p>
                      Opponent Point:{" "}
                      {
                        currentPoints.filter(
                          (p) =>
                            p.set_id === set.id &&
                            p.point_type === "unknown" &&
                            p.scoring_team_id !== managedTeam.id
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Point Distribution by Set</CardTitle>
            <CardDescription>
              Breakdown of scoring methods in each set
            </CardDescription>
          </CardHeader>
          <CardContent className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="set" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="points.serves"
                  stackId="home"
                  fill="hsl(var(--chart-1))"
                  name="Serves"
                />
                <Bar
                  dataKey="points.spikes"
                  stackId="home"
                  fill="hsl(var(--chart-2))"
                  name="Spikes"
                />
                <Bar
                  dataKey="points.blocks"
                  stackId="home"
                  fill="hsl(var(--chart-3))"
                  name="Blocks"
                />
                <Bar
                  dataKey="points.errors"
                  stackId="home"
                  fill="hsl(var(--chart-4))"
                  name="Opponent Errors"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Error Distribution by Set</CardTitle>
            <CardDescription>
              Breakdown of scoring methods in each set
            </CardDescription>
          </CardHeader>
          <CardContent className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="set" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="errors.serves"
                  stackId="home"
                  fill="hsl(var(--chart-1))"
                  name="Serves"
                />
                <Bar
                  dataKey="errors.spikes"
                  stackId="home"
                  fill="hsl(var(--chart-2))"
                  name="Spikes"
                />
                <Bar
                  dataKey="errors.blocks"
                  stackId="home"
                  fill="hsl(var(--chart-3))"
                  name="Blocks"
                />
                <Bar
                  dataKey="errors.points"
                  stackId="home"
                  fill="hsl(var(--chart-4))"
                  name="Opponent Points"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  }
);

SetBreakdown.displayName = "SetBreakdown";

export { SetBreakdown };
