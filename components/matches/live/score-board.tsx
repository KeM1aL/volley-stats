"use client";

import { useState, useEffect } from "react";
import {
  Match,
  Set,
  ScorePoint,
  Player,
  Substitution,
  Team,
} from "@/lib/types";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent } from "@/components/ui/card";
import { CourtDiagram } from "./court-diagram";
import { useToast } from "@/hooks/use-toast";
import { Score } from "@/lib/enums";
import { PointsHistory } from "./points-history";
import { Badge } from "@/components/ui/badge";
import PlayerReplacementDialog from "./player-replacement-dialog";

type ScoreBoardProps = {
  match: Match;
  set: Set;
  score: Score;
  managedTeam: Team;
  players: Player[];
  playerById: Map<string, Player>;
  points: ScorePoint[];
  onSubstitution: (substitution: Substitution) => Promise<void>;
};

export function ScoreBoard({
  match,
  set,
  score,
  managedTeam,
  players,
  playerById,
  points,
  onSubstitution,
}: ScoreBoardProps) {
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row justify-center gap-2">
        <div className="basis-1/3 flex flex-col items-center space-y-2">
          {managedTeam && managedTeam.id === match.home_team_id && (
            <PlayerReplacementDialog
              set={set}
              match={match}
              players={players}
              playerById={playerById}
              onSubstitution={onSubstitution}
            />
          )}
        </div>
        <Card className="basis-1/3">
          <CardContent className="p-2">
            <div className="flex justify-between">
              <div className="flex flex-col items-center space-y-2">
                <h2 className="text-2xl font-bold">Home</h2>
                <div className="text-4xl font-bold">{set.home_score}</div>
                {set.server_team_id === match.home_team_id && (
                  <Badge variant="secondary" className="mt-2">
                    Serving
                  </Badge>
                )}
              </div>
              <div className="text-6xl font-bold mx-4">-</div>
              <div className="flex flex-col items-center space-y-2">
                <h2 className="text-2xl font-bold">Ext.</h2>
                <div className="text-4xl font-bold">{set.away_score}</div>
                {set.server_team_id === match.away_team_id && (
                  <Badge variant="secondary" className="mt-2">
                    Serving
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-center text-muted-foreground">
              Set {set.set_number}
            </div>
          </CardContent>
        </Card>
        <div className="basis-1/3 flex flex-col items-center space-y-2">
          {managedTeam && managedTeam.id === match.away_team_id && (
            <PlayerReplacementDialog
              set={set}
              match={match}
              players={players}
              playerById={playerById}
              onSubstitution={onSubstitution}
            />
          )}
        </div>
      </div>
      <PointsHistory match={match} points={points} />

      <div className="mt-auto">
        <CourtDiagram players={players} playerById={playerById} lineup={set.current_lineup} />
      </div>
    </div>
  );
}
