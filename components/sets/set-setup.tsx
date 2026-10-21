"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { Match, TeamMember, Set, Team } from "@/lib/types";
import {
  FIELD_ROLES,
  SetLineup,
  emptyLineup,
  emptyPositions,
  existingPositions,
  placePlayer,
  positionsMissingRole,
  roleAt,
  setLibero,
  setRole,
  toPlayerRoles,
} from "@/lib/matches/set-lineup";
import { CourtDiagram } from "../matches/live/court-diagram";
import { PlayerSelector } from "../matches/live/player-selector";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";

/** Value of the libero select "None" item (an item value can not be empty). */
const NO_LIBERO = "none";

type SetSetupProps = {
  match: Match;
  sets: Set[];
  players: TeamMember[];
  playerById: Map<string, TeamMember>;
  homeTeam: Team;
  awayTeam: Team;
  setNumber: number;
  onComplete: (set: Set) => Promise<void>;
  onAddLatePlayer?: () => Promise<TeamMember | null>;
};

export function SetSetup({
  match,
  sets,
  players,
  playerById,
  homeTeam,
  awayTeam,
  onComplete,
  onAddLatePlayer,
}: SetSetupProps) {
  const t = useTranslations("matches");
  const tp = useTranslations("players");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const [selectedPosition, setSelectedPosition] =
    useState<PlayerPosition | null>(null);
  const [serverTeamId, setServerTeamId] = useState<string | null>(null);
  const [lineup, setLineup] = useState<SetLineup>(emptyLineup);
  const [isLoading, setIsLoading] = useState(false);

  const existing = existingPositions(match.match_formats?.format);
  const missingRole = positionsMissingRole(lineup, existing);
  const selectedPlayerId = selectedPosition
    ? lineup.positions[selectedPosition]
    : undefined;
  const selectedPlayer = selectedPlayerId
    ? (playerById.get(selectedPlayerId) ?? null)
    : null;
  const selectedRole = selectedPosition ? roleAt(lineup, selectedPosition) : null;
  const selectedRoleMissing =
    selectedPosition !== null && !!selectedPlayerId && !selectedRole;

  const handleSelectPlayer = (player: TeamMember) => {
    if (!selectedPosition) return;
    // Picking the player already here again must not reset a role chosen by hand
    if (lineup.positions[selectedPosition] === player.id) return;
    setLineup((prev) =>
      placePlayer(prev, selectedPosition, player.id, player.position)
    );
  };

  const handleSelectPosition = (position: PlayerPosition | null) => {
    setSelectedPosition(position);
  };

  const handleComplete = async () => {
    if (emptyPositions(lineup, existing).length > 0) {
      toast({
        variant: "destructive",
        title: tc("errors.generalError"),
        description: t("sets.allPositionsMustBeSpecified"),
      });
      setIsLoading(false);
      return;
    }
    if (missingRole.length > 0) {
      toast({
        variant: "destructive",
        title: tc("errors.generalError"),
        description: t("sets.rolesMissing", {
          positions: missingRole.map((position) => position.toUpperCase()).join(", "),
        }),
      });
      return;
    }
    if ((sets.length === 0 || sets.length === 4) && !serverTeamId) {
      toast({
        variant: "destructive",
        title: tc("errors.generalError"),
        description: t("sets.servingTeamMustBeSpecified"),
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
    const playerRoles = toPlayerRoles(lineup, existing);
    const effectiveLineup = Object.fromEntries(
      existing.map((position) => [position, lineup.positions[position]!])
    ) as Record<PlayerPosition, string>;

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
    <div data-testid="set-setup" className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2 md:mb-4">{t("sets.setupTitle", {
          name: [
            t("sets.firstSet"),
            t("sets.secondSet"),
            t("sets.thirdSet"),
            t("sets.fourthSet"),
            t("sets.tieBreak"),
          ][sets.length] ?? ""
        })}</h2>
        <div className="space-y-2">
          {(sets.length === 0 || sets.length === 4) && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>{t("sets.selectServingTeam")}</Label>
                <Select
                  onValueChange={(value) => setServerTeamId(value as string)}
                >
                  <SelectTrigger data-testid="serving-team-select">
                    <SelectValue placeholder={t("sets.selectServingTeam")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={homeTeam.id}>{homeTeam.name}</SelectItem>
                    <SelectItem value={awayTeam.id}>{awayTeam.name}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={cn("md:col-span-2 w-full max-w-2xl", selectedPosition ? "" : "md:col-start-2")}>
                <CourtDiagram
                  players={players}
                  playerById={playerById}
                  lineup={lineup.positions}
                  invalidPositions={missingRole}
                  matchFormat={match.match_formats!}
                  onSelect={handleSelectPosition}
                />
            </div>

            {selectedPosition && (
              <Card className="p-1 space-y-2 border-indigo-500 col-span-2">
                <PlayerSelector
                  players={players.filter((player) =>
                    Object.entries(lineup.positions).every(
                      ([key, value]) =>
                        key === selectedPosition || value !== player.id
                    )
                  )}
                  selectedPlayer={selectedPlayer}
                  onPlayerSelect={handleSelectPlayer}
                />
                {onAddLatePlayer && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      data-testid="late-player-link"
                      onClick={async () => {
                        const player = await onAddLatePlayer();
                        if (player) void handleSelectPlayer(player);
                      }}
                    >
                      {t("live.latePlayer.link")}
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-6">
                  <div className="col-span-2 col-start-2">
                    <Label>{tp("form.role")}</Label>
                    <div className="flex flex-row items-center space-x-1">
                      <Select
                        value={selectedRole ?? ""}
                        onValueChange={(value: PlayerRole) => {
                          if (selectedPosition)
                            setLineup((prev) => setRole(prev, selectedPosition, value));
                        }}
                      >
                        <SelectTrigger
                          data-testid="role-select"
                          aria-invalid={selectedRoleMissing || undefined}
                          className={cn(selectedRoleMissing && "border-destructive")}
                        >
                          <SelectValue placeholder={tp("form.selectRole")} />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {te(`playerRole.${role}`)}
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
                <Label>{t("sets.libero")}</Label>
                <div className="flex flex-row items-center space-x-1">
                  <Select
                    value={lineup.liberoId ?? ""}
                    onValueChange={(value) =>
                      setLineup((prev) =>
                        setLibero(prev, value === NO_LIBERO ? null : value)
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("sets.selectPlayer")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_LIBERO}>
                        {t("sets.none")}
                      </SelectItem>
                      {players
                        .filter(
                          (player) =>
                            !Object.values(lineup.positions).includes(player.id)
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

      <Button data-testid="start-set-btn" onClick={handleComplete} className="w-full" disabled={isLoading}>
        {t("sets.startSet")}
      </Button>
    </div>
  );
}
