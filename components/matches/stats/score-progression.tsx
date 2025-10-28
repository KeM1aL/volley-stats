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
import { PdfExportHandle } from "@/lib/pdf/types";

interface ScoreProgressionProps {
  match: Match;
  points: ScorePoint[];
  sets: Set[];
  isPdfGenerating?: boolean;
}

const ScoreProgression = React.forwardRef<
  PdfExportHandle,
  ScoreProgressionProps
>(({ match, sets, points, isPdfGenerating }, ref) => {
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const scoreProgressionRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
      let currentYOffset = initialYOffset;
      const margin = 20;
      const imgWidth = 595 - 2 * margin;

      const setsToIterate = [...allSets.map((s) => s.id)];

      for (const setId of setsToIterate) {
        setSelectedSet(setId);
        await new Promise((resolve) => setTimeout(resolve, 1000));

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

        if (scoreProgressionRef.current) {
          const canvas = await html2canvas(scoreProgressionRef.current, {
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
          console.warn(`Score Progression content element not found for PDF export.`);
        }
      }
      return currentYOffset;
    },
  }));

  const progressionData = points
    .filter((p) => selectedSet === null || p.set_id === selectedSet)
    .map((point, index) => ({
      point: index + 1,
      home: point.home_score,
      away: point.away_score,
      difference: point.home_score - point.away_score,
    }));

  return (
    <div ref={scoreProgressionRef} id="scores-section-content" className="space-y-6">
      <SetSelector sets={sets} selectedSetId={selectedSet} onSelectSet={setSelectedSet} />
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
                isAnimationActive={!!!isPdfGenerating}
              />
              <Line
                type="monotone"
                dataKey="away"
                stroke="hsl(var(--chart-2))"
                name="Away"
                strokeWidth={2}
                isAnimationActive={!!!isPdfGenerating}
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
                isAnimationActive={!!!isPdfGenerating}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
});

ScoreProgression.displayName = "ScoreProgression";

export { ScoreProgression };
