"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerPosition, PlayerRole } from "@/lib/enums";
import { toast } from "@/hooks/use-toast";
import { Match, TeamMember, Set, Team, MatchFormat } from "@/lib/types";
import { string } from "zod";
import { CourtDiagram } from "../matches/live/court-diagram";
import { PlayerSelector } from "../matches/live/player-selector";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";

type SetSetupProps = {
  match: Match;
  sets: Set[];
  players: TeamMember[];
  playerById: Map<string, TeamMember>;
  homeTeam: Team;
  awayTeam: Team;
  setNumber: number;
  onComplete: (set: Set) => Promise<void>;
};

const NAMES = [
  "First Set",
  "Second Set",
  "Third Set",
  "Fourth Set",
  "Tie-Break",
];

export function SetSetup({
  match,
  sets,
  players,
  playerById,
  homeTeam,
  awayTeam,
  onComplete,
}: SetSetupProps) {
  const [selectedPosition, setSelectedPosition] =
    useState<PlayerPosition | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlayerRole | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<TeamMember | null>(null);
  const [serverTeamId, setServerTeamId] = useState<string | null>(null);
  const [lineup, setLineup] = useState<Record<PlayerRole, string[]>>(
    {} as Record<PlayerRole, string[]>
  );
  const [positions, setPosition] = useState<Record<PlayerPosition, string>>(
    {} as Record<PlayerPosition, string>
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedRole && selectedPlayer && selectedPosition) {
      setLineup((prev) => {
        const filteredLineup = {} as Record<PlayerRole, string[]>;
        Object.entries(prev).forEach(([role, players]) => {
          filteredLineup[role as PlayerRole] = players.filter(
            (playerId) => playerId !== selectedPlayer.id
          );
        });
        if (filteredLineup[selectedRole]) {
          filteredLineup[selectedRole].push(selectedPlayer.id);
        } else {
          filteredLineup[selectedRole] = [selectedPlayer.id];
        }
        return filteredLineup;
      });
      setLineup((prev) => ({
        ...prev,
        [selectedRole]: [...prev[selectedRole], selectedPlayer.id],
      }));
      setPosition((prev) => ({
        ...prev,
        [selectedPosition]: selectedPlayer.id,
      }));
    }
  }, [selectedRole, selectedPlayer, selectedPosition]);

  const handleSelectPlayer = async (player: TeamMember) => {
    setSelectedPlayer(player);
    if (player.position) {
      setSelectedRole(player.position as PlayerRole);
    } else {
      setSelectedRole(null);
    }
  };

  const handleSelectPosition = async (position: PlayerPosition | null) => {
    if (!position) {
      setSelectedPosition(null);
      setSelectedRole(null);
      setSelectedPlayer(null);
      return;
    }
    if (positions[position]) {
      let playerId = positions[position];
      let player = playerById.get(playerId);
      if (player) {
        setSelectedPlayer(player);
      } else {
        setSelectedPlayer(null);
      }
      const role = Object.keys(lineup).find((role) =>
        lineup[role as PlayerRole].includes(playerId)
      );
      if (role) {
        setSelectedRole(role as PlayerRole);
      } else {
        setSelectedRole(null);
      }
    } else {
      setSelectedPlayer(null);
      setSelectedRole(null);
    }
    setSelectedPosition(position);
  };

  const handleComplete = async () => {
    // setIsLoading(true);

    //list of existing positions based on matchFormat ie 2x2 means only P1 & P2 exists
    const existingPositions: PlayerPosition[] = [
      PlayerPosition.P1,
      PlayerPosition.P2,
    ];
    switch (match.match_formats?.format) {
      case "3x3":
        existingPositions.push(PlayerPosition.P3);
        break;
      case "4x4":
        existingPositions.push(PlayerPosition.P3, PlayerPosition.P4);
        break;
      case "6x6":
        existingPositions.push(
          PlayerPosition.P3,
          PlayerPosition.P4,
          PlayerPosition.P5,
          PlayerPosition.P6
        );
        break;
    }

    if (existingPositions.some((position) => !positions[position])) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "All positions must be specified",
      });
      setIsLoading(false);
      return;
    }
    if ((sets.length === 0 || sets.length === 4) && !serverTeamId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Serving team must be specified",
      });
      setIsLoading(false);
      return;
    }
    let setServerTeamId = serverTeamId;
    if (!setServerTeamId) {
      if (sets[sets.length - 1].first_server_team_id === homeTeam.id) {
        setServerTeamId = awayTeam.id;
      } else {
        setServerTeamId = homeTeam.id;
      }
    }
    let playerRoles: Record<string, PlayerRole> = {};
    Object.values(PlayerRole).forEach((role) => {
      const players = lineup[role];
      if (players && players.length > 0) {
        players.forEach((player) => {
          playerRoles[player] = role;
        });
      }
    });

    const effectiveLineup = Object.entries(existingPositions).reduce(
      (acc, [_key, value]) => {
        acc[value as PlayerPosition] = positions[value as PlayerPosition];
        return acc;
      },
      {} as Record<PlayerPosition, string>
    );

    // Save lineups and start the set
    const set: Set = {
      id: crypto.randomUUID(),
      match_id: match.id,
      set_number: sets.length + 1,
      home_score: 0,
      away_score: 0,
      status: "live",
      first_server_team_id: setServerTeamId,
      server_team_id: setServerTeamId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_lineup: effectiveLineup,
      current_lineup: effectiveLineup,
      player_roles: playerRoles,
    };
    try {
      await onComplete(set);
    } catch (error) {
      console.error("Failed to start set:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">{`${
          NAMES[sets.length]
        } Setup`}</h2>
        <div className="space-y-2">
          {(sets.length === 0 || sets.length === 4) && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Serving Team</Label>
                <Select
                  onValueChange={(value) => setServerTeamId(value as string)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select serving team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={homeTeam.id}>{homeTeam.name}</SelectItem>
                    <SelectItem value={awayTeam.id}>{awayTeam.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-4">
            <div className={cn("flex justify-center items-start col-span-2", selectedPosition ? "" : "col-start-2")}>
              <div className="w-full max-w-2xl">
                <CourtDiagram
                  players={players}
                  playerById={playerById}
                  lineup={positions}
                  matchFormat={match.match_formats!}
                  onSelect={handleSelectPosition}
                />
              </div>
            </div>

            {selectedPosition && (
              <Card className="p-1 space-y-2 border-indigo-500/100 col-span-2">
                <PlayerSelector
                  players={players.filter((player) =>
                    Object.entries(positions).every(
                      ([key, value]) =>
                        key === selectedPosition || value !== player.id
                    )
                  )}
                  selectedPlayer={selectedPlayer}
                  onPlayerSelect={handleSelectPlayer}
                />
                <div className="grid grid-cols-4 gap-6">
                  <div className="col-span-2 col-start-2">
                    <Label>Role {selectedRole}</Label>
                    <div className="flex flex-row items-center space-x-1">
                      <Select
                        value={
                          selectedRole ? (selectedRole as string) : undefined
                        }
                        onValueChange={(value: PlayerRole) => {
                          setSelectedRole(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select role`} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(PlayerRole)
                            .filter((role) => role !== PlayerRole.LIBERO)
                            .map((role) => (
                              <SelectItem key={role} value={role}>
                                {(() => {
                                  switch (role) {
                                    case PlayerRole.SETTER:
                                      return "Setter";
                                    case PlayerRole.OPPOSITE:
                                      return "Opposite";
                                    case PlayerRole.OUTSIDE_HITTER:
                                      return "Outside Hitter";
                                    case PlayerRole.MIDDLE_HITTER:
                                      return "Middle Hitter";
                                  }
                                })()}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
          {match.match_formats?.format === "6x6" && (
            <div className="grid grid-cols-4 gap-6">
              <div className="col-span-2 col-start-2">
                <Label>Libero</Label>
                <div className="flex flex-row items-center space-x-1">
                  <Select
                    defaultValue={null as unknown as string}
                    onValueChange={(value) =>
                      setLineup((prev) => ({
                        ...prev,
                        [PlayerRole.LIBERO]: [value],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select player`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null as unknown as string}>
                        None
                      </SelectItem>
                      {players
                        .filter((player) =>
                          Object.entries(lineup).every(
                            ([key, values]) =>
                              key === PlayerRole.LIBERO ||
                              !values.includes(player.id)
                          )
                        )
                        .map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.number} - {player.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* <Separator /> */}

      <Button onClick={handleComplete} className="w-full" disabled={isLoading}>
        Start Set
      </Button>
    </div>
  );
}
