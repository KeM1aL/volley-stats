"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live-match-header";
import { ScoreBoard } from "@/components/matches/score-board";
import { StatTracker } from "@/components/matches/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match, Set } from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";

export default function LiveMatchPage() {
  const { matchId } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [set, setSet] = useState<Set | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMatch = async () => {
      if (!db) return;

      const matchDoc = await db.matches.findOne(matchId as string).exec();
      if (matchDoc) {
        setMatch(matchDoc.toJSON());
        const setDoc = await db.sets.insert({
          id: crypto.randomUUID(),
          match_id: matchId as string,
          status: 'live',
          set_number: 1,
          home_score: 0,
          away_score: 0
        });
        if (setDoc) {
          setSet(setDoc.toJSON());
        }
      }
      setIsLoading(false);
    };

    loadMatch();
  }, [db, matchId]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  if (!set) {
    return <div>Set not found</div>;
  }

  return (
    <div className="space-y-6">
      <LiveMatchHeader match={match} set={set} />

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <ScoreBoard match={match} set={set} />
        </Card>

        <Card className="p-6">
          <StatTracker match={match} set={set} />
        </Card>
      </div>
    </div>
  );
}