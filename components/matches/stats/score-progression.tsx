"use client";

import React, { useState, useRef, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
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
>(({ sets, points, isPdfGenerating }, ref) => {
  const t = useTranslations("matches");
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const scoreProgressionRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    generatePdfContent: async (doc, initialYOffset, allSets, tabTitle) => {
      let currentYOffset = initialYOffset;
      const margin = 20;
      const imgWidth = 595 - 2 * margin;
      let isFirstPage = true;

      const setsToIterate = [...allSets.map((s) => s.id)];

      for (const setId of setsToIterate) {
        setSelectedSet(setId);
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

        if (scoreProgressionRef.current) {
          const canvas = await html2canvas(scoreProgressionRef.current, {
            scale: 1.5,
            useCORS: true,
            logging: false,
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.6);
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (currentYOffset + imgHeight > doc.internal.pageSize.height - margin) {
            doc.addPage();
            currentYOffset = margin;
          }
          doc.addImage(imgData, "JPEG", margin, currentYOffset, imgWidth, imgHeight);
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
  progressionData.unshift({
    point: 0,
    home: 0,
    away: 0,
    difference: 0,
  });

  return (
    <div ref={scoreProgressionRef} id="scores-section-content" className="space-y-6">
      <SetSelector sets={sets} selectedSetId={selectedSet} onSelectSet={setSelectedSet} />
      <Card>
        <CardHeader>
          <CardTitle>{t("stats.scoreProgression")}</CardTitle>
          <CardDescription>{t("stats.scoreProgressionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}>
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
                isAnimationActive={!isPdfGenerating}
              />
              <Line
                type="monotone"
                dataKey="away"
                stroke="hsl(var(--chart-2))"
                name="Away"
                strokeWidth={2}
                isAnimationActive={!isPdfGenerating}
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
        <CardContent className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}>
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
                isAnimationActive={!isPdfGenerating}
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
