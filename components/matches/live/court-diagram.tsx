"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MatchFormat, TeamMember } from "@/lib/types";
import { PlayerPosition } from "@/lib/enums";

interface CourtDiagramProps {
  players: TeamMember[];
  playerById: Map<string, TeamMember>;
  lineup: { [key in PlayerPosition]?: string };
  matchFormat: MatchFormat;
  className?: string;
  onSelect?: (position: PlayerPosition | null) => void;
}

export function CourtDiagram({
  players,
  playerById,
  lineup,
  matchFormat,
  className,
  onSelect,
}: CourtDiagramProps) {
  const t = useTranslations("matches");
  const [selectedPosition, setSelectedPosition] =
    useState<PlayerPosition | null>(null);
  const [netPosition, setNetPosition] = useState<"right" | "left">("right");
  let existingPositions: PlayerPosition[] = [];
  let coordByPosition: {
    [key in "right" | "left"]: {
      [key in PlayerPosition]?: { x: string; y: string };
    };
  } = {
    right: {},
    left: {},
  };

  if (matchFormat) {
    if (matchFormat.format === "2x2") {
      existingPositions = [PlayerPosition.P1, PlayerPosition.P2];

      coordByPosition = {
        right: {
          p1: { x: "25%", y: "75%" },
          p2: { x: "25%", y: "25%" },
        },
        left: {
          p2: { x: "75%", y: "75%" },
          p1: { x: "75%", y: "25%" },
        },
      };
    } else if (matchFormat.format === "3x3") {
      existingPositions = [
        PlayerPosition.P1,
        PlayerPosition.P2,
        PlayerPosition.P3,
      ];

      coordByPosition = {
        right: {
          p1: { x: "25%", y: "75%" },
          p2: { x: "25%", y: "25%" },
          p3: { x: "25%", y: "25%" },
        },
        left: {
          p3: { x: "75%", y: "75%" },
          p2: { x: "75%", y: "75%" },
          p1: { x: "75%", y: "25%" },
        },
      };
    } else if (matchFormat.format === "4x4") {
      existingPositions = [
        PlayerPosition.P1,
        PlayerPosition.P2,
        PlayerPosition.P3,
        PlayerPosition.P4,
      ];

      coordByPosition = {
        right: {
          p1: { x: "40%", y: "80%" },
          p2: { x: "80%", y: "50%" },
          p3: { x: "40%", y: "20%" },
          p4: { x: "25%", y: "50%" },
        },
        left: {
          p4: { x: "75%", y: "50%" },
          p3: { x: "70%", y: "80%" },
          p2: { x: "20%", y: "50%" },
          p1: { x: "70%", y: "20%" },
        },
      };
    } else if (matchFormat.format === "6x6") {
      existingPositions = [
        PlayerPosition.P1,
        PlayerPosition.P2,
        PlayerPosition.P3,
        PlayerPosition.P4,
        PlayerPosition.P5,
        PlayerPosition.P6,
      ];

      coordByPosition = {
        right: {
          p1: { x: "25%", y: "75%" },
          p2: { x: "75%", y: "75%" },
          p3: { x: "75%", y: "50%" },
          p4: { x: "75%", y: "25%" },
          p5: { x: "25%", y: "25%" },
          p6: { x: "25%", y: "50%" },
        },
        left: {
          p6: { x: "75%", y: "50%" },
          p5: { x: "75%", y: "75%" },
          p4: { x: "25%", y: "75%" },
          p3: { x: "25%", y: "50%" },
          p2: { x: "25%", y: "25%" },
          p1: { x: "75%", y: "25%" },
        },
      };
    }
  }

  return (
    <div className={cn("relative aspect-[3/2] bg-muted rounded-lg min-h-[200px] max-h-[400px]", className)}>
      {/* Court outline */}
      <div className="absolute inset-4 border-2 border-primary">
        {/* 3-meter line */}
        {netPosition === "right" && (
          <div className="absolute top-0 right-1/3 bottom-0 border-r-2 border-dashed border-primary opacity-50" />
        )}
        {netPosition === "left" && (
          <div className="absolute top-0 right-2/3 bottom-0 border-r-2 border-dashed border-primary opacity-50" />
        )}

        {/* Player positions */}
        {existingPositions !== undefined &&
          existingPositions.map((pos) => (
            <div
              key={pos}
              className="absolute w-10 h-10 md:w-12 md:h-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{
                left: coordByPosition[netPosition][pos]?.x,
                top: coordByPosition[netPosition][pos]?.y,
              }}
            >
              <Button
                variant="ghost"
                data-testid={`court-position-${pos}`}
                className={`flex items-center justify-center w-full h-full rounded-full bg-background ${
                  selectedPosition === pos
                    ? "border-4 border-indigo-500/100"
                    : "border-2 border-primary"
                }`}
                onClick={() => {
                  if (selectedPosition === pos) {
                    setSelectedPosition(null);
                    onSelect?.(null);
                  } else {
                    setSelectedPosition(pos);
                    onSelect?.(pos);
                  }
                }}
              >
                <span className="text-sm font-medium">
                  {lineup[pos]
                    ? `#${playerById.get(lineup[pos]!)?.number}`
                    : pos.toUpperCase()}
                </span>
              </Button>
            </div>
          ))}
      </div>

      {/* Rotation control */}
      <Button
        size="sm"
        variant="outline"
        className="absolute bottom-2 right-6"
        onClick={() =>
          setNetPosition(netPosition === "right" ? "left" : "right")
        }
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        {t("court.rotateCourt")}
      </Button>
    </div>
  );
}
