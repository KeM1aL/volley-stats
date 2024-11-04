"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live-match-header";
import { ScoreBoard } from "@/components/matches/score-board";
import { StatTracker } from "@/components/matches/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match } from "@/lib/supabase/types";

export default function LiveMatchPage() {
  const { id } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMatch = async () => {
      if (!db) return;

      const matchDoc = await db.matches.findOne(id as string).exec();
      if (matchDoc) {
        setMatch(matchDoc.toJSON());
      }
      setIsLoading(false);
    };

    loadMatch();
  }, [db, id]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-6">
      <LiveMatchHeader match={match} />
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <ScoreBoard match={match} />
        </Card>
        
        <Card className="p-6">
          <StatTracker match={match} />
        </Card>
      </div>
    </div>
  );
}