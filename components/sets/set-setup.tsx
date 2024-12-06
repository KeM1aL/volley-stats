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

type SetSetupProps = {
  match: Match;
  sets: Set[];
  players: Player[];
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
  homeTeam,
  awayTeam,
  onComplete,
}: SetSetupProps) {
  const [serverTeamId, setServerTeamId] = useState<string | null>(null);
  const [lineup, setLineup] = useState<Record<PlayerRole, string>>(
    {} as Record<PlayerRole, string>
  );
  const [positions, setPosition] = useState<Record<PlayerPosition, string>>(
    {} as Record<PlayerPosition, string>
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    if (
      !lineup[PlayerRole.SETTER] ||
      !lineup[PlayerRole.OPPOSITE] ||
      !lineup[PlayerRole.OUTSIDE_BACK] ||
      !lineup[PlayerRole.OUTSIDE_FRONT] ||
      !lineup[PlayerRole.MIDDLE_BACK] ||
      !lineup[PlayerRole.MIDDLE_FRONT]
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "All roles (except Libero) must be filled",
      });
      setIsLoading(false);
      return;
    }
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
      const player = lineup[role];
      if (player) {
        playerRoles[player] = role;
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
        <div className="grid grid-cols-4 gap-6">
          {Object.values(PlayerRole).map((role) => (
            <div
              key={role}
              className={`col-span-2 ${
                role === PlayerRole.LIBERO ? "col-start-2" : ""
              }`}
            >
              <Label>
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
                    case PlayerRole.LIBERO:
                      return "Libero";
                  }
                })()}
              </Label>
              <div className="flex flex-row items-center space-x-1">
                <Select
                  onValueChange={(value) =>
                    setLineup((prev) => ({ ...prev, [role]: value }))
                  }
                >
                  <SelectTrigger
                    className={role === PlayerRole.LIBERO ? "" : "basis-2/3"}
                  >
                    <SelectValue placeholder={`Select player`} />
                  </SelectTrigger>
                  <SelectContent>
                    {players
                      .filter((player) =>
                        Object.entries(lineup).every(
                          ([key, value]) => key === role || value !== player.id
                        )
                      )
                      .map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.number} - {player.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {role !== PlayerRole.LIBERO && (
                  <Select
                    onValueChange={(value: PlayerPosition) =>
                      setPosition((prev) => {
                        const filteredPositions: Record<
                          PlayerPosition,
                          string
                        > = {} as Record<PlayerPosition, string>;
                        Object.keys(prev).forEach((key) => {
                          const playerId = prev[key as PlayerPosition];
                          if (playerId !== lineup[role]) {
                            filteredPositions[key as PlayerPosition] = playerId;
                          }
                        });
                        if (value) {
                          filteredPositions[value] = lineup[role];
                        }
                        return filteredPositions;
                      })
                    }
                    disabled={!lineup[role]}
                  >
                    <SelectTrigger className="basis-1/3">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null as unknown as string}>
                        None
                      </SelectItem>
                      {Object.values(PlayerPosition)
                        .filter(
                          (position) =>
                            !positions[position] ||
                            positions[position] === lineup[role]
                        )
                        .map((position) => (
                          <SelectItem key={position} value={position as string}>
                            {position}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
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
      </div>

      {/* <Separator /> */}

      <Button
        onClick={handleComplete}
        className="w-full"
        disabled={isLoading || !serverTeamId}
      >
        Start Set
      </Button>
    </div>
  );
}
