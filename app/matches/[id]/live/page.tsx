"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
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
  Team,
} from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { PointType, Score, StatResult } from "@/lib/types";

interface MatchState {
  match: Match | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  set: Set | null;
  points: ScorePoint[];
  sets: Set[];
  stats: PlayerStat[];
  score: Score;
}

const initialMatchState: MatchState = {
  match: null,
  homeTeam: null,
  awayTeam: null,
  set: null,
  points: [],
  sets: [],
  stats: [],
  score: { home: 0, away: 0 },
};

export default function LiveMatchPage() {
  const { id: matchId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { db } = useDb();
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState);
  const [players, setPlayers] = useState<Player[]>([]);
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [isLoading, setIsLoading] = useState(true);

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
            sort: [{ updated_at: "asc" }],
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
      setManagedTeam(teams.find((team) => team.id === teamId));
      setOpponentTeam(teams.find((team) => team.id !== teamId));
      const playerIds =
        teamId === match.home_team_id
          ? match.home_available_players
          : match.away_available_players;
      const availablePlayerDocs = await db.players.findByIds(playerIds).exec();
      if (availablePlayerDocs) {
        setPlayers(
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
      console.table(points);

      setMatchState({
        match,
        homeTeam: teams[0],
        awayTeam: teams[1],
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

  const onSetSetupComplete = useCallback(async (newSet: Set) => {
    setMatchState((prev) => ({
      ...prev,
      set: newSet,
      sets: [...prev.sets, newSet],
      score: { home: 0, away: 0 },
      points: [],
      stats: [],
    }));
  }, []);

  const onPlayerStatRecorded = useCallback(
    async (stat: PlayerStat) => {
      try {
        await db?.player_stats.insert(stat);
        setMatchState((prev) => ({
          ...prev,
          stats: [...prev.stats, stat],
        }));

        if (
          stat.result === StatResult.ERROR ||
          stat.result === StatResult.SUCCESS
        ) {
          const pointType = stat.stat_type as PointType;
          if (Object.values(PointType).includes(pointType)) {
            const isSuccess = stat.result === StatResult.SUCCESS;
            const isError = stat.result === StatResult.ERROR;
            const newHomeScore = matchState.score.home + (isSuccess ? 1 : 0);
            const newAwayScore = matchState.score.away + (isError ? 1 : 0);

            const point: ScorePoint = {
              id: crypto.randomUUID(),
              match_id: stat.match_id,
              set_id: stat.set_id,
              scoring_team: isSuccess ? "home" : "away",
              point_type: pointType,
              player_id: stat.player_id,
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              home_score: newHomeScore,
              away_score: newAwayScore,
              current_rotation: matchState.set!.current_lineup,
            };

            await onPointRecorded(point);
          }
        }

        toast({
          title: "Stat recorded",
          description: `${stat.stat_type} ${stat.result} recorded`,
        });
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
      if (!matchState.set || !matchState.match) return;

      try {
        await db?.score_points.insert(point);
        setMatchState((prev) => ({
          ...prev,
          points: [...prev.points, point],
          score: { home: point.home_score, away: point.away_score },
        }));

        const setNumber = matchState.set.set_number;
        const {
          home_score: homeScore,
          away_score: awayScore,
          scoring_team: scoringTeam,
        } = point;

        const setUpdatedFields: Partial<Set> = {
          updated_at: new Date().toISOString(),
          home_score: homeScore,
          away_score: awayScore,
        };
        if (matchState.set.server !== scoringTeam) {
          setUpdatedFields.server = scoringTeam;
        }

        let setTerminated = false;
        if (
          (setNumber < 5 &&
            (homeScore >= 25 || awayScore >= 25) &&
            Math.abs(homeScore - awayScore) >= 2) ||
          (setNumber === 5 &&
            (homeScore >= 15 || awayScore >= 15) &&
            Math.abs(homeScore - awayScore) >= 2)
        ) {
          setUpdatedFields.status = "completed";
          setTerminated = true;
        }

        await db?.sets.findOne(matchState.set.id).update({
          $set: setUpdatedFields,
        });
        setMatchState((prev) => ({
          ...prev,
          set: { ...prev.set!, ...setUpdatedFields },
        }));

        if (setTerminated) {
          const matchUpdatedFields: Partial<Match> = {
            updated_at: new Date().toISOString(),
            home_score:
              homeScore > awayScore
                ? matchState.match.home_score + 1
                : matchState.match.home_score,
            away_score:
              awayScore > homeScore
                ? matchState.match.away_score + 1
                : matchState.match.away_score,
          };

          let matchTerminated = false;
          if (
            matchUpdatedFields.home_score === 3 ||
            matchUpdatedFields.away_score === 3
          ) {
            matchUpdatedFields.status = "completed";
            matchTerminated = true;
          }
          await db?.matches.findOne(matchState.match.id).update({
            $set: matchUpdatedFields,
          });
          setMatchState((prev) => ({
            ...prev,
            match: { ...prev.match!, ...matchUpdatedFields },
          }));
          if (matchTerminated) {
            router.push(`/matches/${matchState.match.id}/stats`);
          }
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
    [db, matchState.set, matchState.match, router]
  );

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!matchState.match || !matchState.homeTeam || !matchState.awayTeam) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-2">
      <LiveMatchHeader match={matchState.match} sets={matchState.sets} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-2">
          {matchState.set && (
            <ScoreBoard
              match={matchState.match}
              set={matchState.set}
              score={matchState.score}
              points={matchState.points}
            />
          )}
        </Card>

        <Card className="p-2">
          {!matchState.set || matchState.set.status === "completed" ? (
            <SetSetup
              match={matchState.match}
              homeTeam={matchState.homeTeam}
              awayTeam={matchState.awayTeam}
              setNumber={matchState.set ? matchState.set.set_number + 1 : 1}
              players={players}
              onComplete={onSetSetupComplete}
            />
          ) : (
            <StatTracker
              onStat={onPlayerStatRecorded}
              onPoint={onPointRecorded}
              opponentTeam={opponentTeam!}
              managedTeam={managedTeam!}
              match={matchState.match}
              currentSet={matchState.set}
              sets={matchState.sets}
              stats={matchState.stats}
              points={matchState.points}
              score={matchState.score}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
