"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/supabase/types";
import { PlayerPosition } from "@/lib/types";

interface CourtDiagramProps {
  players: Player[];
  current_lineup: {
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    p5: string;
    p6: string;
  };
  className?: string;
}

export function CourtDiagram({
  players,
  current_lineup,
  className,
}: CourtDiagramProps) {
  const [netPosition, setNetPosition] = useState<"right" | "left">("right");
  const [playerById, setPlayerById] = useState<Map<string, Player>>(new Map());

  useEffect(() => {
    const loadData = async () => {
      const playerById: Map<string, Player> = new Map();
      players.forEach((player) => {
        playerById.set(player.id, player);
      });
      setPlayerById(playerById);
    };

    loadData();
  }, [players]);

  const coordByPosition: {
    [key in "right" | "left"]: {
      [key in PlayerPosition]: { x: string; y: string };
    };
  } = {
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

  return (
    <div className={cn("relative aspect-[3/2] bg-muted rounded-lg", className)}>
      {/* Court outline */}
      <div className="absolute inset-4 border-2 border-primary rounded">
        {/* 3-meter line */}
        {netPosition === 'right' && <div className="absolute top-0 right-1/3 bottom-0 border-r-2 border-dashed border-primary opacity-50" />}
        {netPosition === 'left' && <div className="absolute top-0 right-2/3 bottom-0 border-r-2 border-dashed border-primary opacity-50" />}

        {/* Player positions */}
        {Object.values(PlayerPosition).map((pos) => (
          <div
            key={pos}
            className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: coordByPosition[netPosition][pos].x,
              top: coordByPosition[netPosition][pos].y,
            }}
          >
            <div className="flex items-center justify-center w-full h-full rounded-full bg-background border-2 border-primary">
              <span className="text-sm font-medium">#{playerById.get(current_lineup[pos])?.number}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rotation control */}
      <Button
        size="sm"
        variant="outline"
        className="absolute bottom-6 right-6"
        onClick={() => setNetPosition(netPosition === "right" ? "left" : "right")}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Rotate Court
      </Button>
    </div>
  );
}
