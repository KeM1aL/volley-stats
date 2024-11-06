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
import { SetSetup } from "@/components/sets/set-setup";

export default function LiveMatchPage() {
  const { matchId } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [set, setSet] = useState<Set | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const onSetSetupComplete  = (set: Set) => {
    setSet(set);
  }

  useEffect(() => {
    const loadMatch = async () => {
      if (!db) return;

      const matchDoc = await db.matches.findOne(matchId as string).exec();
      if (matchDoc) {
        setMatch(matchDoc.toMutableJSON());
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

  return (
    <div className="space-y-4">
      <LiveMatchHeader match={match} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          {/* <ScoreBoard match={match} set={set} /> */}
        </Card>

        <Card className="p-6">
          {(!set || set.status === 'completed') ? <SetSetup match={match} onComplete={onSetSetupComplete} /> : <StatTracker match={match} set={set} />}
        </Card>
      </div>
    </div>
  );
}