"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Match } from "@/lib/supabase/types";
import { MatchSetup } from "@/components/matches/match-setup";

export default function LiveMatchPage() {
  const { id: matchId } = useParams();
  const { db } = useDb();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const onSetupComplete = () => {
    router.push(`/matches/${matchId as string}/live`);
  };

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
    <Card className="max-w-2xl mx-auto p-6">
      <MatchSetup match={match} onComplete={onSetupComplete} />
    </Card>
  );
}