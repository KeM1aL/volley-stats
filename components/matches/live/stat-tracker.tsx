"use client";

import { useEffect, useState } from "react";
import { Match, TeamMember, PlayerStat, ScorePoint, Set, Team } from "@/lib/types";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  StatType,
  StatResult,
  Score,
  PointType,
  PlayerRole,
  PlayerPosition,
} from "@/lib/enums";
import { StatButton, variants } from "./stat-button";
import { useToast } from "@/hooks/use-toast";
import { PlayerSelector } from "./player-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useCommandHistory } from "@/hooks/use-command-history";
import { useLandscape } from "@/hooks/use-landscape";

type StatTrackerProps = {
  match: Match;
  opponentTeam: Team;
  managedTeam: Team;
  currentSet: Set;
  sets: Set[];
  stats: PlayerStat[];
  score: Score;
  points: ScorePoint[];
  playerById: Map<string, TeamMember>;
  onPoint: (point: ScorePoint) => Promise<void>;
  onStat: (stat: PlayerStat) => Promise<void>;
  onUndo: () => Promise<void>;
};

const inGameStatTypes = [StatType.SPIKE, StatType.BLOCK, StatType.DEFENSE];

// Distinct colors for stat type labels - avoiding button colors (red, green, blue, yellow)
const colorData = [
  { color: "bg-violet-700", border: "border-violet-500" },    // SERVE/RECEPTION - violet
  { color: "bg-slate-600", border: "border-slate-400" },       // SPIKE - slate gray
  { color: "bg-cyan-600", border: "border-cyan-400" },        // BLOCK - cyan
  { color: "bg-pink-500", border: "border-pink-400" },        // DEFENSE - pink
  { color: "bg-slate-600", border: "border-slate-400" },
  { color: "bg-amber-600", border: "border-amber-400" },
  { color: "bg-teal-600", border: "border-teal-400" },
  { color: "bg-indigo-600", border: "border-indigo-400" },
  { color: "bg-fuchsia-600", border: "border-fuchsia-400" },
  { color: "bg-lime-600", border: "border-lime-400" },
  { color: "bg-rose-600", border: "border-rose-400" },
  { color: "bg-sky-600", border: "border-sky-400" },
];

export function StatTracker({
  match,
  currentSet,
  opponentTeam,
  managedTeam,
  playerById,
  sets,
  stats,
  points,
  score,
  onPoint,
  onStat,
  onUndo,
}: StatTrackerProps) {
  const { localDb: db } = useLocalDb();
  const { toast } = useToast();
  const { canUndo, canRedo } = useCommandHistory();
  const isLandscape = useLandscape();
  const [selectedPlayer, setSelectedPlayer] = useState<TeamMember | null>(null);
  const [availableStatTypes, setAvailableStatTypes] =  useState<StatType[]>(Object.values(StatType));
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [liberoPlayer, setLiberoPlayer] = useState<TeamMember | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const setPlayerIds = Object.values(currentSet.current_lineup);
      const players: TeamMember[] = [];
      for (const playerId of setPlayerIds) {
        const player = playerById.get(playerId);
        if (player) {
          players.push(player);
        }
      }
      setPlayers(players);
      const liberoPlayerId = Object.keys(currentSet.player_roles).find(
        (key) => currentSet.player_roles[key] === PlayerRole.LIBERO
      );
      if (liberoPlayerId) {
        setLiberoPlayer(playerById.get(liberoPlayerId)!);
      } else {
        setLiberoPlayer(null);
      }

      setIsLoading(false);
    };

    if (!isLoading) {
      setIsLoading(true);
    }
    loadData();
  }, [match.id, currentSet.id, currentSet.current_lineup]);

  useEffect(() => {
    const updateData = async () => {
      if(currentSet.server_team_id === managedTeam.id) {
        let servingPlayer = playerById.get(currentSet.current_lineup.p1!);
        if(servingPlayer) {
          setSelectedPlayer(servingPlayer);
        }
        setAvailableStatTypes([StatType.SERVE,...inGameStatTypes])
      } else {
        setAvailableStatTypes([StatType.RECEPTION,...inGameStatTypes])
      }

     
    };
    updateData();
  }, [match.id, currentSet]);

  const recordStat = async (type: StatType, result: StatResult) => {
    if (!selectedPlayer) {
      toast({
        title: "Select a player",
        description: "Please select a player before recording a stat",
        variant: "destructive",
      });
      return;
    }

    setIsRecording(true);
    try {
      let position: PlayerPosition | null = null;
      if(liberoPlayer && liberoPlayer.id === selectedPlayer.id) {
        position = null;
      } else {
      position = Object.entries(currentSet.current_lineup).find(
          ([_position, playerId]) => playerId === selectedPlayer.id
        )![0] as PlayerPosition;
      }

      const playerStat = {
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: currentSet.id,
        player_id: selectedPlayer.id,
        team_id: selectedPlayer.team_id,
        position: position,
        stat_type: type,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlayerStat;
      await onStat(playerStat);
      setSelectedPlayer(null);
      
    } finally {
      setIsRecording(false);
    }
  };

  const recordPoint = async (
    actionTeamId: string,
    type: PointType,
    result: StatResult
  ) => {
    setIsRecording(true);
    try {
      const isSuccess = result === StatResult.SUCCESS;
      const isError = result === StatResult.ERROR;
      const scoringTeamId = isSuccess ? managedTeam.id : opponentTeam.id;
      const newHomeScore =
        scoringTeamId === match.home_team_id ? score.home + 1 : score.home;
      const newAwayScore =
        scoringTeamId === match.away_team_id ? score.away + 1 : score.away;
      const pointNumber = newHomeScore + newAwayScore;

      const timestamp = new Date().toISOString();
      const point: ScorePoint = {
        id: crypto.randomUUID(),
        match_id: match.id,
        set_id: currentSet.id,
        point_number: pointNumber,
        scoring_team_id: scoringTeamId,
        point_type: type,
        player_id: null,
        timestamp: timestamp,
        created_at: timestamp,
        home_score: newHomeScore,
        away_score: newAwayScore,
        current_rotation: currentSet!.current_lineup,
        player_stat_id: null,
        action_team_id: actionTeamId,
        result: isSuccess ? StatResult.SUCCESS : StatResult.ERROR,
      };
      await onPoint(point);
      setSelectedPlayer(null);
    } finally {
      setIsRecording(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[120px] w-full" />
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-[100px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Landscape layout - player selection on top, stat cards + team points on right
  if (isLandscape) {
    return (
      <CardContent className="flex flex-col h-full p-1 gap-1">
        {/* Top row: Player Selector - full width with proper-sized buttons */}
        <div className="shrink-0">
          <PlayerSelector
            players={players}
            liberoPlayer={liberoPlayer}
            selectedPlayer={selectedPlayer}
            onPlayerSelect={setSelectedPlayer}
            isLandscape={true}
          />
        </div>

        {/* Bottom row: Stat Cards + Team Points/Undo */}
        <div className="flex-1 flex gap-1 min-h-0">
          {/* Left: Stat Cards - scrollable */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {availableStatTypes.map((type, index) => (
              <div
                key={type}
                className={`flex items-stretch rounded-md overflow-hidden ${colorData[index].border} border`}
              >
                {/* Stat type label */}
                <div
                  className={`${colorData[index].color} text-white px-2 flex items-center justify-center min-w-[45px]`}
                >
                  <span className="text-[10px] font-bold whitespace-nowrap">
                    {type.replace("_", " ").substring(0, 5).toUpperCase()}
                  </span>
                </div>
                {/* Stat buttons - horizontal */}
                <div className="flex-1 grid grid-cols-4 gap-0.5 p-0.5">
                  {Object.values(StatResult).map((result) => (
                    <StatButton
                      key={result}
                      result={result}
                      onClick={() => recordStat(type, result)}
                      disabled={isRecording || !selectedPlayer}
                      isLoading={isRecording}
                      isLandscape={true}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Team Point Buttons + Undo */}
          <div className="w-[140px] flex flex-col gap-1">
            <Button
              onClick={() =>
                recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.ERROR)
              }
              disabled={isRecording || isLoading}
              className={cn(
                "flex-1 text-[10px] font-semibold transition-transform active:scale-95 px-1",
                variants[StatResult.ERROR]
              )}
            >
              <div className="text-center">
                <div className="font-medium truncate">{managedTeam.name.substring(0, 10)}</div>
                <div className="opacity-75">Error -1</div>
              </div>
            </Button>
            <Button
              onClick={() =>
                recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.SUCCESS)
              }
              disabled={isRecording || isLoading}
              className={cn(
                "flex-1 text-[10px] font-semibold transition-transform active:scale-95 px-1",
                variants[StatResult.SUCCESS]
              )}
            >
              <div className="text-center">
                <div className="font-medium truncate">{managedTeam.name.substring(0, 10)}</div>
                <div className="opacity-75">Point +1</div>
              </div>
            </Button>
            <Button
              onClick={() =>
                recordPoint(opponentTeam.id, PointType.UNKNOWN, StatResult.ERROR)
              }
              disabled={isRecording || isLoading}
              className={cn(
                "flex-1 text-[10px] font-semibold transition-transform active:scale-95 px-1",
                variants[StatResult.ERROR]
              )}
            >
              <div className="text-center">
                <div className="font-medium truncate">{opponentTeam.name.substring(0, 10)}</div>
                <div className="opacity-75">Point -1</div>
              </div>
            </Button>
            <Button
              onClick={() =>
                recordPoint(opponentTeam.id, PointType.UNKNOWN, StatResult.SUCCESS)
              }
              disabled={isRecording || isLoading}
              className={cn(
                "flex-1 text-[10px] font-semibold transition-transform active:scale-95 px-1",
                variants[StatResult.SUCCESS]
              )}
            >
              <div className="text-center">
                <div className="font-medium truncate">{opponentTeam.name.substring(0, 10)}</div>
                <div className="opacity-75">Error +1</div>
              </div>
            </Button>
            {/* Undo button */}
            <Button
              variant="outline"
              onClick={() => onUndo()}
              disabled={isRecording || isLoading}
              className="h-7 text-[10px] font-semibold"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Undo
            </Button>
          </div>
        </div>
      </CardContent>
    );
  }

  // Portrait layout - original vertical design
  return (
    <CardContent className="flex flex-col max-h-[85vh] p-0">
      {/* Player Selector - Fixed at top */}
      <div className="shrink-0">
        <PlayerSelector
          players={players}
          liberoPlayer={liberoPlayer}
          selectedPlayer={selectedPlayer}
          onPlayerSelect={setSelectedPlayer}
        />
      </div>

      {/* Stat Cards Section - Scrollable on mobile only */}
      <div className="space-y-1 overflow-y-auto md:overflow-y-hidden py-1 touch-manipulation">
        {availableStatTypes.map((type, index) => (
          <Card
            key={type}
            className={`w-full mx-auto overflow-hidden ${colorData[index].border} border-2`}
          >
            <div className="flex">
              {/* Vertical text on the left side */}
              <div
                className={`text-primary-foreground p-2 md:p-4 flex items-center justify-center relative ${colorData[index].color}`}
              >
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-base md:text-xl font-bold origin-center">
                  {type.replace("_", " ").substring(0, 5)}
                </span>
              </div>
              <div className="flex-1">
                <CardContent className="p-1">
                  <div className="grid grid-cols-4 gap-1 md:gap-2">
                    {Object.values(StatResult).map((result) => (
                      <StatButton
                        key={result}
                        result={result}
                        onClick={() => recordStat(type, result)}
                        disabled={isRecording || !selectedPlayer}
                        isLoading={isRecording}
                      />
                    ))}
                  </div>
                </CardContent>
              </div>
              <div
                className={`text-primary-foreground p-2 md:p-4 flex items-center justify-center relative ${colorData[index].color}`}
              >
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90 whitespace-nowrap text-base md:text-xl font-bold origin-center">
                  {type.replace("_", " ").substring(0, 5)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Point Buttons + Undo - Separated with margin */}
      <div className="space-y-1 mt-1 sm:mt-2">
        <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2">
          <Button
            onClick={() =>
              recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.ERROR)
            }
            disabled={isRecording || isLoading}
            className={cn(
              "min-h-10 sm:min-h-14 md:min-h-16 text-sm sm:text-base md:text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.ERROR]
            )}
          >
            <div>
              <div className="text-xs sm:text-sm md:text-md font-medium truncate">
                '{managedTeam.name}' Error
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm opacity-75">-1</div>
            </div>
          </Button>
          <Button
            onClick={() =>
              recordPoint(managedTeam.id, PointType.UNKNOWN, StatResult.SUCCESS)
            }
            disabled={isRecording || isLoading}
            className={cn(
              "min-h-10 sm:min-h-14 md:min-h-16 text-sm sm:text-base md:text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.SUCCESS]
            )}
          >
            <div>
              <div className="text-xs sm:text-sm md:text-md font-medium truncate">
                '{managedTeam.name}' Point
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm opacity-75">+1</div>
            </div>
          </Button>
          <Button
            onClick={() =>
              recordPoint(opponentTeam.id, PointType.UNKNOWN, StatResult.ERROR)
            }
            disabled={isRecording || isLoading}
            className={cn(
              "min-h-10 sm:min-h-14 md:min-h-16 text-sm sm:text-base md:text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.ERROR]
            )}
          >
            <div>
              <div className="text-xs sm:text-sm md:text-md font-medium truncate">
                '{opponentTeam.name}' Point
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm opacity-75">-1</div>
            </div>
          </Button>
          <Button
            onClick={() =>
              recordPoint(
                opponentTeam.id,
                PointType.UNKNOWN,
                StatResult.SUCCESS
              )
            }
            disabled={isRecording || isLoading}
            className={cn(
              "min-h-10 sm:min-h-14 md:min-h-16 text-sm sm:text-base md:text-lg font-semibold transition-transform active:scale-95",
              variants[StatResult.SUCCESS]
            )}
          >
            <div>
              <div className="text-xs sm:text-sm md:text-md font-medium truncate">
                '{opponentTeam.name}' Error
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm opacity-75">+1</div>
            </div>
          </Button>
        </div>
        <div className="grid grid-cols-1">
          <Button
            variant="outline"
            onClick={() => onUndo()}
            disabled={isRecording || isLoading}
            className={cn(
              "min-h-9 sm:min-h-12 md:min-h-14 text-sm sm:text-base md:text-lg font-semibold transition-transform active:scale-95"
            )}
          >
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" /> Cancel Last Action
          </Button>
        </div>
      </div>
    </CardContent>
  );
}
