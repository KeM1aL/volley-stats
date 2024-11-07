"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { LiveMatchHeader } from "@/components/matches/live-match-header";
import { ScoreBoard } from "@/components/matches/score-board";
import { StatTracker } from "@/components/matches/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
} from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";

export default function MatchStatsPage() {
  const { matchId } = useParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const matchDoc = await db.matches.findOne(matchId as string).exec();
      if (matchDoc) {
        setMatch(matchDoc.toMutableJSON());
      }
      const [pointDocs, statDocs, setDocs] = await Promise.all([
        db.score_points
          .find({
            selector: {
              match_id: matchId as string,
            },
          })
          .exec(),
        db.player_stats
          .find({
            selector: {
              match_id: matchId as string,
            },
          })
          .exec(),
        db.sets
          .find({
            selector: {
              match_id: matchId as string,
            },
          })
          .exec(),
        // db.players
        //   .find({
        //     selector: {
        //       team_id: match.home_team_id,
        //     },
        //   })
        //   .exec(),
      ]);

      setPoints(pointDocs.map((doc) => doc.toJSON()));
      setStats(statDocs.map((doc) => doc.toJSON()));
      setSets(setDocs.map((doc) => doc.toJSON()));
      // setPlayers(playerDocs.map((doc) => doc.toJSON()));
      setIsLoading(false);
    };

    loadData();
  }, [db, matchId]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return <div className="space-y-4"></div>;
}
