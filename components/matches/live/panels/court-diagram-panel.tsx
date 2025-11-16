"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MatchFormat, TeamMember, Set, Team } from "@/lib/types";
import { PlayerPosition } from "@/lib/enums";

export type NetPosition = "right" | "left" | "top" | "bottom";

interface CourtDiagramPanelProps {
  players: TeamMember[];
  currentSet?: Set | null;
  matchFormat: MatchFormat;
  team: Team;
}

export function CourtDiagramPanel({
  players,
  currentSet,
  matchFormat,
  team,
}: CourtDiagramPanelProps) {
  const [netPosition, setNetPosition] = useState<
    NetPosition
  >("top");

  // Get lineup from current set
  const lineup = currentSet?.current_lineup || {};
  const playerById = new Map(players.map((p) => [p.id, p]));

  let existingPositions: PlayerPosition[] = [];
  let coordByPosition: {
    [key in NetPosition]: {
      [key in PlayerPosition]?: { x: string; y: string };
    };
  } = {
    right: {},
    left: {},
    top: {},
    bottom: {},
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
        top: {
          p1: { x: "25%", y: "75%" },
          p2: { x: "75%", y: "75%" },
        },
        bottom: {
          p1: { x: "75%", y: "25%" },
          p2: { x: "25%", y: "25%" },
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
          p3: { x: "75%", y: "50%" },
        },
        left: {
          p3: { x: "75%", y: "75%" },
          p2: { x: "75%", y: "75%" },
          p1: { x: "75%", y: "25%" },
        },
        top: {
          p1: { x: "75%", y: "75%" },
          p2: { x: "50%", y: "25%" },
          p3: { x: "25%", y: "75%" },
        },
        bottom: {
          p3: { x: "75%", y: "25%" },
          p2: { x: "50%", y: "75%" },
          p1: { x: "25%", y: "25%" },
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
        top: {
          p1: { x: "50%", y: "80%" },
          p2: { x: "80%", y: "25%" },
          p3: { x: "50%", y: "15%" },
          p4: { x: "20%", y: "25%" },
        },
        bottom: {
          p1: { x: "50%", y: "25%" },
          p2: { x: "20%", y: "75%" },
          p3: { x: "50%", y: "85%" },
          p4: { x: "80%", y: "75%" },
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
        top: {
          p1: { x: "75%", y: "75%" },
          p2: { x: "75%", y: "25%" },
          p3: { x: "50%", y: "25%" },
          p4: { x: "25%", y: "25%" },
          p5: { x: "25%", y: "75%" },
          p6: { x: "50%", y: "75%" },
        },
        bottom: {
          p1: { x: "25%", y: "25%" },
          p2: { x: "25%", y: "75%" },
          p3: { x: "50%", y: "75%" },
          p4: { x: "75%", y: "75%" },
          p5: { x: "75%", y: "25%" },
          p6: { x: "50%", y: "25%" },
        },
      };
    }
  }

  const getServerPosition = (): PlayerPosition | null => {
    if (!currentSet || !matchFormat.rotation) return null;
    // In volleyball, position 1 is always the server
    return PlayerPosition.P1;
  };

  const serverPosition = getServerPosition();

  const rotateNetPosition = (
    netPosition: NetPosition
  ): NetPosition => {
    if (netPosition === "right") {
      return "left";
    } else if (netPosition === "left") {
      return "right";
    } else if (netPosition === "top") {
      return "bottom";
    } else {
      return "top";
    }
  };

  const netClass = (netPosition: NetPosition): string => {
     if (netPosition === "right") {
      return "right-0 top-0 bottom-0";
    } else if (netPosition === "left") {
      return "left-0 top-0 bottom-0";
    } else if (netPosition === "top") {
      return "top-0 left-0 right-0";
    } else {
      return "bottom-0 left-0 right-0";
    }
  }

  const aspectRatioClass = (netPosition: NetPosition): string => {
    if(netPosition === "right" || netPosition === "left") {
      return "aspect-[3/2]";
    } else {
      return "aspect-[2/3]";
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-3 text-center">
          <CardTitle className="text-sm font-medium">Court Position {currentSet && (
          <span className="text-xs text-muted-foreground">
            {team.name}
          </span>
        )}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {!currentSet ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No active set
          </div>
        ) : (
          <>
            {/* Court Diagram */}
            <div className={cn("relative bg-muted rounded-lg w-full",
              aspectRatioClass(netPosition)
            )}>
              {/* Court outline */}
              <div className="absolute inset-4 border-2 border-primary">
                {/* Net position indicator */}
                <div
                  className={cn(
                    "absolute w-1 bg-primary",
                    netClass(netPosition)
                  )}
                />

                {/* 3-meter line */}
                {netPosition === "right" && (
                  <div className="absolute top-0 right-1/3 bottom-0 border-r-2 border-dashed border-primary opacity-30" />
                )}
                {netPosition === "left" && (
                  <div className="absolute top-0 right-2/3 bottom-0 border-r-2 border-dashed border-primary opacity-30" />
                )}
                {netPosition === "top" && (
                  <div className="absolute top-1/3 right-0 left-0 border-t-2 border-dashed border-primary opacity-30" />
                )}
                {netPosition === "bottom" && (
                  <div className="absolute top-2/3 right-0 left-0 border-t-2 border-dashed border-primary opacity-30" />
                )}

                {/* Player positions */}
                {existingPositions.map((pos) => {
                  const playerId = lineup[pos];
                  const player = playerId ? playerById.get(playerId) : null;
                  const isServer =
                    matchFormat.rotation && serverPosition === pos && currentSet.server_team_id === team.id;

                  return (
                    <div
                      key={pos}
                      className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: coordByPosition[netPosition][pos]?.x,
                        top: coordByPosition[netPosition][pos]?.y,
                      }}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-full h-full rounded-full bg-background border-2",
                          isServer
                            ? "border-green-500 ring-2 ring-green-500/50"
                            : player
                            ? "border-primary"
                            : "border-dashed border-muted-foreground"
                        )}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xs font-bold leading-none">
                            {player ? `#${player.number}` : pos.toUpperCase()}
                          </span>
                          {isServer && (
                            <span className="text-[8px] text-green-600 font-semibold mt-0.5">
                              SRV
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 flex justify-between items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNetPosition(rotateNetPosition(netPosition))}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                <span className="text-xs">Rotate</span>
              </Button>
              <div className="text-xs text-muted-foreground">
                Net:{" "}
                <Badge variant="secondary" className="text-xs">
                  {netPosition}
                </Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
