"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Player } from "@/lib/supabase/types";

interface CourtDiagramProps {
  players: Player[];
  className?: string;
}

export function CourtDiagram({ players, className }: CourtDiagramProps) {

  const positions_right = [
    { id: 1, x: "25%", y: "75%", label: "P1" },
    { id: 2, x: "75%", y: "75%", label: "P2" },
    { id: 3, x: "75%", y: "50%", label: "P3" },
    { id: 4, x: "75%", y: "25%", label: "P4" },
    { id: 5, x: "25%", y: "25%", label: "P5" },
    { id: 6, x: "25%", y: "50%", label: "P6" },
  ];

  const positions_left = [
    { id: 1, x: "25%", y: "75%", label: "P1" },
    { id: 2, x: "75%", y: "75%", label: "P2" },
    { id: 3, x: "75%", y: "50%", label: "P3" },
    { id: 4, x: "75%", y: "25%", label: "P4" },
    { id: 5, x: "25%", y: "25%", label: "P5" },
    { id: 6, x: "25%", y: "50%", label: "P6" },
  ];

  return (
    <div className={cn("relative aspect-[3/2] bg-muted rounded-lg p-4", className)}>
      {/* Court outline */}
      <div className="absolute inset-4 border-2 border-primary rounded">
        {/* 3-meter line */}
        <div className="absolute top-0 right-1/3 bottom-0 border-r-2 border-dashed border-primary opacity-50" />
        
        {/* Player positions */}
        {positions_right.map((pos) => (
          <div
            key={pos.id}
            className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="flex items-center justify-center w-full h-full rounded-full bg-background border-2 border-primary">
              <span className="text-sm font-medium">{pos.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rotation control */}
      <Button
        size="sm"
        variant="outline"
        className="absolute bottom-6 right-6"
        // onClick={onRotate}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Rotate
      </Button>
    </div>
  );
}