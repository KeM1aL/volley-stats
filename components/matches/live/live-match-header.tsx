"use client";

import { Match, ScorePoint, Set } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PointsHistory } from "./points-history";
import { update } from "rxdb/plugins/update";

type LiveMatchHeaderProps = {
  match: Match;
  points: ScorePoint[];
};

export function LiveMatchHeader({ match, points }: LiveMatchHeaderProps) {
  
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold">Live Match</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>

        <PointsHistory points={points} />
      </CardContent>
    </Card>
  );
}