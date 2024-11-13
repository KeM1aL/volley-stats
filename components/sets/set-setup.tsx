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
import { Match, Player, Set, Team } from "@/lib/supabase/types";

type SetSetupProps = {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  setNumber: number;
  onComplete: (set: Set) => void;
};

const NAMES = [
  "First Set",
  "Second Set",
  "Third Set",
  "Fourth Set",
  "Tie-Break",
];

export function SetSetup({
  match,
  homeTeam,
  awayTeam,
  setNumber,
  onComplete,
}: SetSetupProps) {
  const { db } = useDb();
  const [players, setPlayers] = useState<Player[]>([]);
  const [server, setServer] = useState<"home" | "away" | null>(null);
  const [lineup, setLineup] = useState<Record<PlayerPosition, string>>(
    {} as Record<PlayerPosition, string>
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAvailablePlayers = async () => {
      if (!db) return;

      const availablePlayerDocs = await db.players
        .findByIds(match.available_players)
        .exec();
      if (availablePlayerDocs) {
        setPlayers(
          Array.from(availablePlayerDocs.values()).map((doc) => doc.toJSON())
        );
      }
      setIsLoading(false);
    };

    loadAvailablePlayers();
  }, [db, match.id]);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      if (
        !lineup[PlayerPosition.SETTER] ||
        !lineup[PlayerPosition.OPPOSITE] ||
        !lineup[PlayerPosition.OUTSIDE_BACK] ||
        !lineup[PlayerPosition.OUTSIDE_FRONT] ||
        !lineup[PlayerPosition.MIDDLE_BACK] ||
        !lineup[PlayerPosition.MIDDLE_FRONT]
      ) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "All positions (except Libero) must be filled",
        });
        setIsLoading(false);
        return;
      }
      // Save lineups and start the set
      const setDoc = await db?.sets.insert({
        id: crypto.randomUUID(),
        match_id: match.id,
        set_number: setNumber,
        home_score: 0,
        away_score: 0,
        status: "live",
        first_server: server!,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        current_lineup: {
          p1: lineup[PlayerPosition.SETTER],
          p2: lineup[PlayerPosition.OPPOSITE],
          p3: lineup[PlayerPosition.OUTSIDE_BACK],
          p4: lineup[PlayerPosition.OUTSIDE_FRONT],
          p5: lineup[PlayerPosition.MIDDLE_BACK],
          p6: lineup[PlayerPosition.MIDDLE_FRONT],
        },
      });
      if (setDoc) {
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
        <h2 className="text-lg font-semibold mb-4">{`${
          NAMES[setNumber - 1]
        } Setup`}</h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.values(PlayerPosition).map((position) => (
            <div
              key={position}
              className={`col-span-2 ${
                position === PlayerPosition.LIBERO ? "col-start-2" : ""
              }`}
            >
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
                    .filter((player) =>
                      Object.entries(lineup).every(
                        ([key, value]) =>
                          key === position || value !== player.id
                      )
                    )
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
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label>Serving Team</Label>
            <Select
              onValueChange={(value) => setServer(value as "home" | "away")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select serving team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{homeTeam.name}</SelectItem>
                <SelectItem value="away">{awayTeam.name}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* <Separator /> */}

      <Button
        onClick={handleComplete}
        className="w-full"
        disabled={isLoading || !server}
      >
        Start Set
      </Button>
    </div>
  );
}
