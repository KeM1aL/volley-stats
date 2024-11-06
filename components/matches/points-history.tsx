"use client";

import { ScorePoint } from "@/lib/supabase/types";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";

interface PointsHistoryProps {
  points: ScorePoint[];
  className?: string;
}

export function PointsHistory({ points, className }: PointsHistoryProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });
  const [pointsHistory, setPointsHistory] = useState<ScorePoint[]>(points);

  const scrollHistory = (direction: "left" | "right") => {
    setVisibleRange((prev) => {
      const step = 5;
      let newStart, newEnd;

      if (direction === "left") {
        newStart = Math.max(0, prev.start - step);
        newEnd = newStart + 10;
      } else {
        newStart = Math.min(pointsHistory.length - 10, prev.start + step);
        newEnd = Math.min(newStart + 10, pointsHistory.length);
      }

      return { start: newStart, end: newEnd };
    });
  };

  const visiblePoints = pointsHistory.slice(
    visibleRange.start,
    visibleRange.end
  );

  return (
    <div className={className}>
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => scrollHistory("left")}
          disabled={visibleRange.start === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="overflow-hidden">
          <div className="flex flex-col space-y-2 px-8">
            <div className="flex space-x-2">
              {visiblePoints.map((point, index) => (
                <Badge
                  key={`teamA-${index + visibleRange.start}`}
                  variant={point.scoring_team === "home" ? "default" : "outline"}
                  className="w-8 h-8 flex items-center justify-center"
                >
                  {point.home_score}
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              {visiblePoints.map((point, index) => (
                <Badge
                  key={`teamB-${index + visibleRange.start}`}
                  variant={point.scoring_team === "away" ? "default" : "outline"}
                  className="w-8 h-8 flex items-center justify-center"
                >
                  {point.away_score}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
          onClick={() => scrollHistory("right")}
          disabled={visibleRange.end >= pointsHistory.length}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
