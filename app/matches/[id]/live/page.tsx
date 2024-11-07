"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live-match-header";
import { ScoreBoard } from "@/components/matches/score-board";
import { StatTracker } from "@/components/matches/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";

export default function LiveMatchPage() {
  const { id: matchId } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [set, setSet] = useState<Set | null>(null);
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const onSetSetupComplete  = (set: Set) => {
    setSet(set);
    setSets([...sets, set]);
  }

  const onPointRecorded = (point: ScorePoint) => {
    setPoints([...points, point]);
  }

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
              sort: [
                {updated_at: 'asc'}
              ]
            })
            .exec(),
          db.player_stats
            .find({
              selector: {
                match_id: matchId as string,
              },
              sort: [
                {updated_at: 'asc'}
              ]
            })
            .exec(),
          db.sets
            .find({
              selector: {
                match_id: matchId as string,
              },
              sort: [
                {updated_at: 'asc'}
              ]
            })
            .exec(),
        ]);

        if (matchDoc) {
          setMatch(matchDoc.toMutableJSON());
        }
        setPoints(pointDocs.map(doc => doc.toJSON()));
        setStats(statDocs.map(doc => doc.toJSON()));
        if(setDocs) {
          setSets(setDocs.map(doc => doc.toJSON()));
          if(setDocs.length > 0) {
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
          {set && <ScoreBoard match={match} set={set} />}
        </Card>

        <Card className="p-6">
          {(!set || set.status === 'completed') ? <SetSetup match={match} onComplete={onSetSetupComplete} /> : <StatTracker onPoint={onPointRecorded} match={match} set={set} />}
        </Card>
      </div>
    </div>
  );
}