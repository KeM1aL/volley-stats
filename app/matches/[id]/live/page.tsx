"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { PointType, Score, StatResult } from "@/lib/types";
import { on } from "events";
import { update } from "rxdb/plugins/update";

export default function LiveMatchPage() {
  const { id: matchId } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [set, setSet] = useState<Set | null>(null);
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [score, setScore] = useState<Score>({ home: 0, away: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const onSetSetupComplete = (set: Set) => {
    setSet(set);
    setSets([...sets, set]);
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

    await db?.sets.findOne(set!.id).update({
      $set: {
        home_score: point.home_score,
        away_score: point.away_score,
        updated_at: new Date().toISOString(),
      },
    });
    const updatedSet = {
      ...set!,
      home_score: point.home_score,
      away_score: point.away_score,
    };
    setSet(updatedSet);
    setScore((prev) => ({ home: point.home_score, away: point.away_score }));

    if (
      (updatedSet.set_number < 5 &&
        (updatedSet.home_score >= 25 || updatedSet.away_score >= 25) &&
        Math.abs(updatedSet.home_score - updatedSet.away_score) === 2) ||
      (updatedSet.set_number === 5 &&
        (updatedSet.home_score >= 15 || updatedSet.away_score >= 15) &&
        Math.abs(updatedSet.home_score - updatedSet.away_score) === 2)
    ) {
      onSetTerminated(updatedSet);
    }
  };

  const onSetTerminated = async (set: Set) => {
    await db?.sets.findOne(set.id).update({
      $set: {
        status: "completed",
        updated_at: new Date().toISOString(),
      },
    });
    
    const matchUpdatedFields = {
      updated_at: new Date().toISOString(),
    } as Partial<Match>;
    if (set.home_score > set.away_score) {
      matchUpdatedFields.home_score = match!.home_score + 1;
    } else {
      matchUpdatedFields.away_score = match!.away_score + 1;
    }
    if (set.set_number === 5) {
      matchUpdatedFields.status = "completed";
    }
    await db?.matches.findOne(set.match_id).update({
      $set: matchUpdatedFields,
    });
  };

  const onMatchTerminated = async (match: Match) => {};

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      try {
        const [matchDoc, pointDocs, statDocs, setDocs] = await Promise.all([
          db.matches.findOne(matchId as string).exec(),
          db.score_points
            .find({
              selector: {
                match_id: matchId as string,
              },
              sort: [{ updated_at: "asc" }],
            })
            .exec(),
          db.player_stats
            .find({
              selector: {
                match_id: matchId as string,
              },
              sort: [{ updated_at: "asc" }],
            })
            .exec(),
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
          setMatch(matchDoc.toMutableJSON());
        }
        setPoints(pointDocs.map((doc) => doc.toJSON()));
        setStats(statDocs.map((doc) => doc.toJSON()));
        if (setDocs) {
          setSets(setDocs.map((doc) => doc.toJSON()));
          if (setDocs.length > 0) {
            setSet(setDocs[setDocs.length - 1].toJSON());
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

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-4">
      <LiveMatchHeader match={match} points={points} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          {set && <ScoreBoard match={match} set={set} score={score} />}
        </Card>

        <Card className="p-6">
          {!set || set.status === "completed" ? (
            <SetSetup match={match} onComplete={onSetSetupComplete} />
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
