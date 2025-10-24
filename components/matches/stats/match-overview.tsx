"use client";

import React, { useState, useRef, useImperativeHandle } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Match,
  TeamMember,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/types";
import { MatchScoreDetails } from "@/components/matches/match-score-details";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";
import { PdfExportHandle } from "@/lib/pdf/types";

interface MatchOverviewProps {
  match: Match;
  managedTeam: Team;
  opponentTeam: Team;
  points: ScorePoint[];
  stats: PlayerStat[];
  sets: Set[];
  players: TeamMember[];
  isPdfGenerating?: boolean;
}

const MatchOverview = React.forwardRef<PdfExportHandle, MatchOverviewProps>(
  (
    {
      match,
      managedTeam,
      opponentTeam,
      points,
      stats,
      sets,
      players,
      isPdfGenerating,
    },
    ref
  ) => {
    const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
    const overviewRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
        let currentYOffset = initialYOffset;
        const margin = 20;
        const imgWidth = 595 - 2 * margin; // A4 width (595pt) - 2 * margin

        const setsToIterate = [null, ...allSets.map((s) => s.id)];

        for (const setId of setsToIterate) {
          setSelectedSetId(setId);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for state update and re-render

          const currentSets = setId
            ? allSets.filter((set) => set.id === setId)
            : allSets;
          const currentPoints = setId
            ? points.filter((point) => point.set_id === setId)
            : points;
          const currentStats = setId
            ? stats.filter((stat) => stat.set_id === setId)
            : stats;

          const subTitle =
            setId === null
              ? "All Sets Overview"
              : `Set ${
                  allSets.find((s) => s.id === setId)?.set_number || ""
                } Breakdown`;

          doc.addPage();
          currentYOffset = margin;
          doc.setFontSize(16);
          doc.text(`${tabTitle} - ${subTitle}`, margin, currentYOffset);
          currentYOffset += 30;

          if (overviewRef.current) {
            const canvas = await html2canvas(overviewRef.current, {
              scale: 2,
              useCORS: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (currentYOffset + imgHeight > doc.internal.pageSize.height - margin) {
              doc.addPage();
              currentYOffset = margin;
            }
            doc.addImage(imgData, "PNG", margin, currentYOffset, imgWidth, imgHeight);
            currentYOffset += imgHeight + margin;
          } else {
            console.warn(`Overview content element not found for PDF export.`);
          }
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
    const currentStats = selectedSetId
      ? stats.filter((stat) => stat.set_id === selectedSetId)
      : stats;

    return (
      <div ref={overviewRef} id="overview-section-content">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Final Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full">
                <MatchScoreDetails
                  match={match}
                  sets={currentSets}
                  homeTeam={
                    match.home_team_id === managedTeam?.id
                      ? managedTeam!
                      : opponentTeam!
                  }
                  awayTeam={
                    match.away_team_id === managedTeam?.id
                      ? managedTeam!
                      : opponentTeam!
                  }
                  isPdfGenerating={isPdfGenerating}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Total Sets: {currentSets.length}</p>
                <p>Total Points: {currentPoints.length}</p>
                <p>Duration: {currentSets.length * 25} minutes</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <MVPAnalysis
          sets={currentSets}
          stats={currentStats}
          players={players}
          isPdfGenerating={isPdfGenerating}
        />
      </div>
    );
  }
);

MatchOverview.displayName = "MatchOverview";

export { MatchOverview };
