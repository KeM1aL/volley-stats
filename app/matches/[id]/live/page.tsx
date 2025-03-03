"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
  Substitution,
  Team,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { PointType, Score, StatResult } from "@/lib/enums";
import { useCommandHistory } from "@/hooks/use-command-history";
import { MatchState } from "@/lib/commands/command";
import {
  PlayerStatCommand,
  ScorePointCommand,
  SetSetupCommand,
  SubstitutionCommand,
} from "@/lib/commands/match-commands";
import { PlayerPerformance } from "@/components/matches/stats/player-performance";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { match } from "assert";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";

const initialMatchState: MatchState = {
  match: null,
  set: null,
  points: [],
  sets: [],
  stats: [],
  score: { home: 0, away: 0 },
};

export default function LiveMatchPage() {
  const { id: matchId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { isOnline, wasOffline } = useOnlineStatus();
  const { localDb: db } = useLocalDb();
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [teamPlayerById, setTeamPlayerById] = useState<Map<string, Player>>(new Map());
  const [homeTeam, setHomeTeam] = useState<Team>();
  const [awayTeam, setAwayTeam] = useState<Team>();
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [isLoading, setIsLoading] = useState(true);
  const { history, canUndo, canRedo } = useCommandHistory();

  useEffect(() => {
    const loadData = async () => {
      const playerById: Map<string, Player> = new Map();
      teamPlayers.forEach((player) => {
        playerById.set(player.id, player);
      });
      setTeamPlayerById(playerById);
    };

    loadData();
  }, [teamPlayers]);

  // Memoized data loading function
  const loadMatchData = useCallback(async () => {
    if (!db) return;

    try {
      setIsLoading(true);

      const [matchDoc, setDocs] = await Promise.all([
        db.matches.findOne(matchId).exec(),
        db.sets
          .find({
            selector: {
              match_id: matchId,
            },
            sort: [{ created_at: "asc" }],
          })
          .exec(),
      ]);

      if (!matchDoc) {
        throw new Error("Match not found");
      }

      const match = matchDoc.toMutableJSON() as Match;
      const teamDocs = await db.teams
        .findByIds([match.home_team_id, match.away_team_id])
        .exec();

      if (!teamDocs || teamDocs.size !== 2) {
        throw new Error("Teams not found");
      }

      const teams = Array.from(teamDocs.values()).map((doc) => doc.toJSON());

      const managedTeamParam = searchParams.get("team");
      if (!managedTeamParam) {
        throw new Error("Please select your managed team");
      }

      const teamId = searchParams.get("team");
      if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
        throw new Error("Managed Team not found");
      }
      setHomeTeam(teams[0]);
      setAwayTeam(teams[1]);
      setManagedTeam(teams.find((team) => team.id === teamId));
      setOpponentTeam(teams.find((team) => team.id !== teamId));

      const playerIds =
        teamId === match.home_team_id
          ? match.home_available_players
          : match.away_available_players;
      const availablePlayerDocs = await db.players.findByIds(playerIds as string[]).exec();
      if (availablePlayerDocs) {
        setTeamPlayers(
          Array.from(availablePlayerDocs.values()).map((doc) => doc.toJSON())
        );
      }

      const sets = setDocs.map((doc) => doc.toJSON());
      const currentSet = sets[sets.length - 1];

      let points: ScorePoint[] = [];
      let stats: PlayerStat[] = [];

      if (currentSet) {
        [points, stats] = await Promise.all([
          db.score_points
            .find({
              selector: {
                match_id: matchId,
                set_id: currentSet.id,
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
          db.player_stats
            .find({
              selector: {
                match_id: matchId,
                set_id: currentSet.id,
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
        ]);
      }

      setMatchState({
        match,
        set: currentSet || null,
        points,
        sets,
        stats,
        score: currentSet
          ? { home: currentSet.home_score, away: currentSet.away_score }
          : { home: 0, away: 0 },
      });
    } catch (error) {
      console.error("Failed to load match data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load match data",
      });
      router.push("/matches/history");
    } finally {
      setIsLoading(false);
    }
  }, [db, matchId, router]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  const onSetSetupComplete = useCallback(
    async (newSet: Set) => {
      if (!db) return;
      const command = new SetSetupCommand(matchState, newSet, db);

      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
      } catch (error) {
        console.error("Failed to complete set setup:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to complete set setup",
        });
      }
    },
    [db, matchState]
  );

  const onSubstitutionRecorded = useCallback(
    async (substitution: Substitution) => {
      if (!db) return;
      const command = new SubstitutionCommand(matchState, substitution, db);

      try {
        const newMatchState = await history.executeCommand(command);

        setMatchState(newMatchState);

        toast({
          title: "Subscription recorded",
          description: `Player #${
            teamPlayerById.get(substitution.player_out_id)!.number
          } substituted for ${
            teamPlayerById.get(substitution.player_in_id)!.number
          }`,
        });
      } catch (error) {
        console.error("Failed to record substitution:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record substitution",
        });
      }
    },
    [db, matchState]
  );

  const onPlayerStatRecorded = useCallback(
    async (stat: PlayerStat) => {
      if (!db) return;

      const command = new PlayerStatCommand(matchState, stat, db);
      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
        if (newMatchState.match!.status === "completed") {
          onMatchCompleted();
        }
      } catch (error) {
        console.error("Failed to record stat:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record stat",
        });
      }
    },
    [db, matchState.score, matchState.set]
  );

  const onPointRecorded = useCallback(
    async (point: ScorePoint) => {
      if (!db) return;
      if (!matchState.set || !matchState.match) return;

      const myTeam = managedTeam!.id === point.scoring_team_id;
      const command = new ScorePointCommand(matchState, point, myTeam, db);
      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
        if (newMatchState.match!.status === "completed") {
          onMatchCompleted();
        }
      } catch (error) {
        console.error("Failed to record point:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record point",
        });
      }
    },
    [db, matchState, router]
  );

  const onMatchCompleted = () => {
    if (isOnline) {
      toast({
        title: "Match Finished",
        description: "Let's go to the stats !",
      });
      const searchParams = new URLSearchParams();
      searchParams.set("team", managedTeam!.id);
      router.push(
        `/matches/${matchState.match!.id}/stats?${searchParams.toString()}`
      );
    } else {
      toast({
        title: "Match Finished",
        description: "You must be online to view the stats",
      });
    }
  };

  const handleUndo = async () => {
    try {
      const state = await history.undo();
      setMatchState(state);

      toast({
        title: "Action undone",
        description: "The last action has been undone",
      });
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to undo action",
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!matchState.match || !homeTeam || !awayTeam) {
    return <div>Match not found</div>;
  }

  if (matchState.match.status === "completed") {
    return (
      <div className="space-y-1">
        <LiveMatchHeader
          match={matchState.match}
          sets={matchState.sets}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
        <MVPAnalysis sets={matchState.sets} stats={matchState.stats} players={teamPlayers} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <LiveMatchHeader
        match={matchState.match}
        sets={matchState.sets}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
      />
      <div className="grid md:grid-cols-3 gap-2">
        {matchState.set && matchState.set.status !== "completed" && (
          <Card className="p-1">
            <ScoreBoard
              match={matchState.match}
              set={matchState.set}
              score={matchState.score}
              managedTeam={managedTeam!}
              points={matchState.points}
              players={teamPlayers}
              playerById={teamPlayerById}
              onSubstitution={onSubstitutionRecorded}
            />
          </Card>
        )}
        {matchState.set && matchState.set.status === "completed" && (
          <Card className="p-1 col-span-2">
            <PlayerPerformance
              match={matchState.match}
              managedTeam={managedTeam!}
              opponentTeam={opponentTeam!}
              players={teamPlayers}
              stats={matchState.stats}
              sets={matchState.sets}
            />
          </Card>
        )}

        {!matchState.set || matchState.set.status === "completed" ? (
          <Card className={`p-1 ${!matchState.set ? "col-start-2" : ""}`}>
            <SetSetup
              match={matchState.match}
              sets={matchState.sets}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              setNumber={matchState.set ? matchState.set.set_number + 1 : 1}
              players={teamPlayers}
              playerById={teamPlayerById}
              onComplete={onSetSetupComplete}
            />
          </Card>
        ) : (
          <Card className="p-1 col-span-2">
            <StatTracker
              onStat={onPlayerStatRecorded}
              onPoint={onPointRecorded}
              onUndo={handleUndo}
              playerById={teamPlayerById}
              opponentTeam={opponentTeam!}
              managedTeam={managedTeam!}
              match={matchState.match}
              currentSet={matchState.set}
              sets={matchState.sets}
              stats={matchState.stats}
              points={matchState.points}
              score={matchState.score}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
