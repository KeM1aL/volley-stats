"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Match,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { PointType, Score, StatResult } from "@/lib/types";

export default function LiveMatchPage() {
  const { id: matchId } = useParams();
  const { db } = useDb();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [server, setServer] = useState<"home" | "away">("home");
  const [set, setSet] = useState<Set | null>(null);
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [score, setScore] = useState<Score>({ home: 0, away: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      try {
        const [matchDoc, setDocs] = await Promise.all([
          db.matches.findOne(matchId as string).exec(),
          db.sets
            .find({
              selector: {
                match_id: matchId as string,
              },
              sort: [{ updated_at: "asc" }],
            })
            .exec(),
        ]);

        if (matchDoc) {
          const match = matchDoc.toMutableJSON() as Match;
          setMatch(match);
          const teamDocs = await db.teams.findByIds([match.home_team_id, match.away_team_id]).exec();
          if (teamDocs && teamDocs.size === 2) {
            const teams = Array.from(teamDocs.values());
            setHomeTeam(teams[0].toJSON());
            setAwayTeam(teams[1].toJSON());
          }
        }
        if (setDocs) {
          setSets(setDocs.map((doc) => doc.toJSON()));
          if (setDocs.length > 0) {
            const set = setDocs[setDocs.length - 1].toJSON();
            setSet(set);
            const [pointDocs, statDocs] = await Promise.all([
              db.score_points
                .find({
                  selector: {
                    match_id: matchId as string,
                    set_id: set.id,
                  },
                  sort: [{ updated_at: "asc" }],
                })
                .exec(),
              db.player_stats
                .find({
                  selector: {
                    match_id: matchId as string,
                    set_id: set.id,
                  },
                  sort: [{ updated_at: "asc" }],
                })
                .exec(),
            ]);
            setPoints(pointDocs.map((doc) => doc.toJSON()));
            setStats(statDocs.map((doc) => doc.toJSON()));
          }
        }
      } catch (error) {
        console.error("Failed to load match data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load match data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [db, matchId]);

  const onSetSetupComplete = (set: Set) => {
    setSet(set);
    setSets([...sets, set]);
    setScore({ home: 0, away: 0 });
    setPoints([]);
    setStats([]);
  };

  const onPlayerStatRecorded = async (stat: PlayerStat) => {
    try {
      await db?.player_stats.insert(stat);

      if (
        stat.result === StatResult.ERROR ||
        stat.result === StatResult.SUCCESS
      ) {
        const pointType = stat.stat_type as string as PointType;
        if (Object.values(PointType).includes(pointType)) {
          const isSuccess = stat.result === StatResult.SUCCESS;
          const isError = stat.result === StatResult.ERROR;
          const newHomeScore = score.home + (isSuccess ? 1 : 0);
          const newAwayScore = score.away + (isError ? 1 : 0);

          const point = {
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
            current_rotation: set!.current_lineup,
          } as ScorePoint;

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
  };

  const onPointRecorded = async (point: ScorePoint) => {
    await db?.score_points.insert(point);
    setPoints([...points, point]);

    const setNumber = set!.set_number;
    const homeScore = point.home_score;
    const awayScore = point.away_score;
    setScore((prev) => ({ home: point.home_score, away: point.away_score }));

    const setUpdatedFields = {
      updated_at: new Date().toISOString(),
      home_score: homeScore,
      away_score: awayScore,
    } as Partial<Set>;

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
    await db?.sets.findOne(set!.id).update({
      $set: setUpdatedFields,
    });
    const updatedSet = {
      ...set!,
      ...setUpdatedFields,
    };
    setSet(updatedSet);

    if (setTerminated) {
      onSetTerminated(updatedSet);
    }
  };

  const onSetTerminated = async (set: Set) => {
    const matchUpdatedFields = {
      updated_at: new Date().toISOString(),
    } as Partial<Match>;
    if (set.home_score > set.away_score) {
      matchUpdatedFields.home_score = match!.home_score + 1;
    } else {
      matchUpdatedFields.away_score = match!.away_score + 1;
    }
    let matchTerminated = false;
    if (
      matchUpdatedFields.home_score === 3 ||
      matchUpdatedFields.away_score === 3
    ) {
      matchTerminated = true;
      matchUpdatedFields.status = "completed";
    }
    await db?.matches.findOne(set.match_id).update({
      $set: matchUpdatedFields,
    });
    const updatedMatch = {
      ...match!,
      ...matchUpdatedFields,
    };
    setMatch(updatedMatch);
    if (matchTerminated) {
      onMatchTerminated(updatedMatch);
    }
  };

  const onMatchTerminated = async (match: Match) => {
    router.push(`/matches/${match.id}/stats`);
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-4">
      <LiveMatchHeader match={match} sets={sets} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          {set && (
            <ScoreBoard match={match} set={set} score={score} points={points} />
          )}
        </Card>

        <Card className="p-4">
          {!set || set.status === "completed" ? (
            <SetSetup
              match={match}
              homeTeam={homeTeam!}
              awayTeam={awayTeam!}
              setNumber={set ? set.set_number + 1 : 1}
              onComplete={onSetSetupComplete}
            />
          ) : (
            <StatTracker
              onStat={onPlayerStatRecorded}
              onPoint={onPointRecorded}
              match={match}
              currentSet={set}
              sets={sets}
              stats={stats}
              points={points}
              score={score}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
