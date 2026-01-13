"use client";

import { Team } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type ChampionshipTeamsSummaryProps = {
  teams: Team[];
  championshipId: string;
};

export function ChampionshipTeamsSummary({
  teams,
  championshipId
}: ChampionshipTeamsSummaryProps) {
  // Calculate unique clubs
  const uniqueClubsCount = new Set(
    teams.filter((team) => team.club_id).map((team) => team.club_id)
  ).size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Active Teams ({teams.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Teams</p>
            <p className="text-2xl font-bold">{teams.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Clubs</p>
            <p className="text-2xl font-bold">{uniqueClubsCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
