"use client";

import { ScorePoint } from "@/lib/supabase/types";
import { Button } from "../../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../../ui/badge";

interface PointsHistoryProps {
  points: ScorePoint[];
  className?: string;
}

const NB_VISIBLE_POINTS = 10;

export function PointsHistory({ points, className }: PointsHistoryProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: NB_VISIBLE_POINTS });

  const visiblePoints = points.slice(visibleRange.start, visibleRange.end);

  useEffect(() => {
    if (points.length > 0) {
      setVisibleRange((prev) => ({
        start: Math.max(0, points.length - NB_VISIBLE_POINTS),
        end: points.length,
      }));
    } else {
      setVisibleRange((prev) => ({
        start: 0,
        end: NB_VISIBLE_POINTS,
      }));
    }
  }, [points]);

  const scrollHistory = (direction: "left" | "right") => {
    setVisibleRange((prev) => {
      const step = Math.round(NB_VISIBLE_POINTS / 4);
      let newStart, newEnd;

      if (direction === "left") {
        newStart = Math.max(0, prev.start - step);
        newEnd = newStart + NB_VISIBLE_POINTS;
      } else {
        newStart = Math.min(points.length - NB_VISIBLE_POINTS, prev.start + step);
        newEnd = Math.min(newStart + NB_VISIBLE_POINTS, points.length);
      }

      return { start: newStart, end: newEnd };
    });
  };

  return (
    <div className={className}>
      <div className="relative">
        {visibleRange.start > 0 && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10"
            onClick={() => scrollHistory("left")}
            disabled={visibleRange.start === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="overflow-hidden">
          <div className="flex flex-col space-y-2 px-8">
            <div className="flex space-x-2">
              {visiblePoints.map((point, index) => (
                <Badge
                  key={`teamA-${index + visibleRange.start}`}
                  variant={
                    point.scoring_team === "home" ? "default" : "outline"
                  }
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
                  variant={
                    point.scoring_team === "away" ? "default" : "outline"
                  }
                  className="w-8 h-8 flex items-center justify-center"
                >
                  {point.away_score}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {visibleRange.end < points.length && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 translate-x-1/2 top-1/2 -translate-y-1/2 z-10"
            onClick={() => scrollHistory("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
