"use client";

import { Match, ScorePoint } from "@/lib/types";
import { Button } from "../../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../../ui/badge";

interface PointsHistoryProps {
  match: Match;
  points: ScorePoint[];
  className?: string;
}

export function PointsHistory({ match, points, className }: PointsHistoryProps) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  const historyContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateVisibleRange = () => {
      if (historyContainerRef.current) {
        const containerWidth = historyContainerRef.current.offsetWidth;
        const badgeWidth = 40; // Assuming each badge is 32px wide + 8px margin
        const visibleCount = Math.floor((containerWidth - 80) / badgeWidth); // Subtracting 80px for the navigation buttons
        const newEnd = Math.min(
          points.length,
          visibleRange.start + visibleCount
        );
        setVisibleRange((prev) => ({ ...prev, end: newEnd }));
      }
    };

    const resizeObserver = new ResizeObserver(updateVisibleRange);
    if (historyContainerRef.current) {
      resizeObserver.observe(historyContainerRef.current);
    }

    updateVisibleRange();

    return () => {
      if (historyContainerRef.current) {
        resizeObserver.unobserve(historyContainerRef.current);
      }
    };
  }, [points.length, visibleRange.start]);

  useEffect(() => {
    if (points.length > 0) {
      setVisibleRange((prev) => ({
        start: Math.max(0, points.length - prev.end + prev.start),
        end: points.length,
      }));
    }
  }, [points]);

  const scrollHistory = (direction: "left" | "right") => {
    setVisibleRange((prev) => {
      const visibleCount = prev.end - prev.start;
      let newStart, newEnd;

      if (direction === "left") {
        newStart = Math.max(0, prev.start - visibleCount);
        newEnd = newStart + visibleCount;
      } else {
        newEnd = Math.min(points.length, prev.end + visibleCount);
        newStart = Math.max(0, newEnd - visibleCount);
      }

      return { start: newStart, end: newEnd };
    });
  };

  const visiblePoints = points.slice(visibleRange.start, visibleRange.end);

  return (
    <div className={className}>
      <div className="relative" ref={historyContainerRef}>
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
          <div className="flex flex-col items-center space-y-2 px-10">
            <div className="flex space-x-2">
              {visiblePoints.map((point, index) => (
                <Badge
                  key={`teamA-${index + visibleRange.start}`}
                  variant={
                    point.scoring_team_id === match.home_team_id ? "default" : "outline"
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
                    point.scoring_team_id === match.away_team_id ? "default" : "outline"
                  }
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
          disabled={visibleRange.end >= points.length}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
