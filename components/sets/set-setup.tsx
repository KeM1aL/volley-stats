"use client";

import { useEffect, useState } from "react";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerPosition, PlayerRole } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Match, Player, Set, Team } from "@/lib/supabase/types";
import { string } from "zod";
import { CourtDiagram } from "../matches/live/court-diagram";
import { PlayerSelector } from "../matches/live/player-selector";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type SetSetupProps = {
  match: Match;
  sets: Set[];
  players: Player[];
  playerById: Map<string, Player>;
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
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
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
      setLineup((prev) => ({
        ...prev,
        [selectedRole]: [...prev[selectedRole], selectedPlayer.id],
      }));
      setPosition((prev) => ({
        ...prev,
        [selectedPosition]: selectedPlayer.id,
      }));
      setSelectedPosition(null);
      setSelectedRole(null);
      setSelectedPlayer(null);
    }
  }, [selectedRole, selectedPlayer, selectedPosition]);

  const handleComplete = async () => {
    // setIsLoading(true);
    if (
      !positions[PlayerPosition.P1] ||
      !positions[PlayerPosition.P2] ||
      !positions[PlayerPosition.P3] ||
      !positions[PlayerPosition.P4] ||
      !positions[PlayerPosition.P5] ||
      !positions[PlayerPosition.P6]
    ) {
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
      first_lineup: {
        p1: positions[PlayerPosition.P1],
        p2: positions[PlayerPosition.P2],
        p3: positions[PlayerPosition.P3],
        p4: positions[PlayerPosition.P4],
        p5: positions[PlayerPosition.P5],
        p6: positions[PlayerPosition.P6],
      },
      current_lineup: {
        p1: positions[PlayerPosition.P1],
        p2: positions[PlayerPosition.P2],
        p3: positions[PlayerPosition.P3],
        p4: positions[PlayerPosition.P4],
        p5: positions[PlayerPosition.P5],
        p6: positions[PlayerPosition.P6],
      },
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
          <CourtDiagram
            players={players}
            playerById={playerById}
            lineup={positions}
            onSelect={setSelectedPosition}
          />

          {selectedPosition && (
            <Card className="p-1 space-y-2 border-indigo-500/100">
              <div className="grid grid-cols-4 gap-6">
                <div className="col-span-2 col-start-2">
                  <Label>Role</Label>
                  <div className="flex flex-row items-center space-x-1">
                    <Select
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
                                  case PlayerRole.OUTSIDE_BACK:
                                    return "Outside Hitter (Back)";
                                  case PlayerRole.OUTSIDE_FRONT:
                                    return "Outside Hitter (Front)";
                                  case PlayerRole.MIDDLE_BACK:
                                    return "Middle Hitter (Back)";
                                  case PlayerRole.MIDDLE_FRONT:
                                    return "Middle Hitter (Front)";
                                }
                              })()}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <PlayerSelector
                players={players.filter((player) =>
                  Object.entries(positions).every(
                    ([key, value]) =>
                      key === selectedPosition || value !== player.id
                  )
                )}
                selectedPlayer={selectedPlayer}
                onPlayerSelect={setSelectedPlayer}
              />
            </Card>
          )}
        </div>
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-2 col-start-2">
            <Label>Libero</Label>
            <div className="flex flex-row items-center space-x-1">
              <Select
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
      </div>

      {/* <Separator /> */}

      <Button onClick={handleComplete} className="w-full" disabled={isLoading}>
        Start Set
      </Button>
    </div>
  );
}
