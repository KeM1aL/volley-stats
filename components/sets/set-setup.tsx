"use client";

import { useEffect, useState } from "react";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerPosition } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Match, Player, Set } from "@/lib/supabase/types";

type SetSetupProps = {
  match: Match;
  onComplete: (set: Set) => void;
};

export function SetSetup({ match, onComplete }: SetSetupProps) {
  const { db } = useDb();
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<Record<PlayerPosition, string>>(
    {} as Record<PlayerPosition, string>
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAvailablePlayers = async () => {
      if (!db) return;

      const availablePlayerDocs = await db.players.findByIds(match.available_players).exec();
      if (availablePlayerDocs) {
        setPlayers(Array.from(availablePlayerDocs.values()).map(doc => doc.toJSON()));
      }
      setIsLoading(false);
    };

    loadAvailablePlayers();
  }, [db, match.id]);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Add start position for each player
      // Save lineups and start the set
      const setDoc = await db?.sets.insert({
        id: crypto.randomUUID(),
        match_id: match.id,
        set_number: 1, // TODO: Implement set number selection
        home_score: 0,
        away_score: 0,
        status: 'live',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        current_lineup: {
          position1: lineup[PlayerPosition.SETTER],
          position2: lineup[PlayerPosition.OPPOSITE],
          position3: lineup[PlayerPosition.OUTSIDE_BACK],
          position4: lineup[PlayerPosition.OUTSIDE_FRONT],
          position5: lineup[PlayerPosition.MIDDLE_BACK],
          position6: lineup[PlayerPosition.MIDDLE_FRONT],
        }
      });
      if(setDoc) {
        onComplete(setDoc.toJSON());
      }
    } catch (error) {
      console.error("Failed to start set:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start set",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Next Set Lineup</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.values(PlayerPosition).map((position) => (
            <div key={position}>
              <Label>{position}</Label>
              <Select
                onValueChange={(value) =>
                  setLineup((prev) => ({ ...prev, [position]: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${position}`} />
                </SelectTrigger>
                <SelectContent>
                  {players
                    // .filter((player) => lineup..id !== selectedTeam)
                    .map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.number} - {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* <Separator /> */}

      <Button onClick={handleComplete} className="w-full" disabled={isLoading}>
        Start Set
      </Button>
    </div>
  );
}
