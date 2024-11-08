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
import { Separator } from "@/components/ui/separator";
import { PlayerPosition } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { Match, Player } from "@/lib/supabase/types";
import { Check, Square, SquareCheckBig } from "lucide-react";
import { Toggle } from "../ui/toggle";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "../ui/form";
import { Switch } from "../ui/switch";
import { update } from "rxdb/plugins/update";

type MatchSetupProps = {
  match: Match;
  onComplete: () => void;
};

export function MatchSetup({ match, onComplete }: MatchSetupProps) {
  const { db } = useDb();
  const [players, setPlayers] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      const teamId = match.home_team_id as string;

      // const supabase = createClient();

      // const playersResponse = await supabase
      //   .from("players")
      //   .select("*")
      //   .eq("team_id", teamId);

      // if (playersResponse.error) throw playersResponse.error;

      const playerDocs = await db.players
        .find({
          selector: {
            team_id: teamId,
          },
        })
        .exec();

      setPlayers(playerDocs.map((doc) => doc.toJSON()));
      setIsLoading(false);
    };

    loadData();
  }, [db, match.id]);

  const sortPlayers = (a: Player, b: Player) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();

    if (aLower < bLower) return -1;
    if (aLower > bLower) return 1;
    return 0;
  };

  const togglePlayerAvailability = (player: Player) => {
    if (availablePlayers.includes(player.id)) {
      setAvailablePlayers(availablePlayers.filter((id) => id !== player.id));
    } else {
      setAvailablePlayers([...availablePlayers, player.id]);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save available players and start the match
      await db?.matches.findOne(match.id).update({
        $set: {
          status: "live",
          available_players: availablePlayers,
          updated_at: new Date().toISOString(),
        },
      });
      onComplete();
    } catch (error) {
      console.error("Failed to start match:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start match",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Match Roster</h2>
        <div className="grid grid-cols-1 gap-4">
          {[...players].sort(sortPlayers).map((player) => (
            <Toggle
              key={player.id}
              variant="outline"
              aria-label="Toggle player availability"
              className="gap-4"
              onClick={() => togglePlayerAvailability(player)}
            >
              {player.name}{" "}
              {availablePlayers.includes(player.id) && (
                <Check className="h-4 w-4" />
              )}
            </Toggle>
          ))}
        </div>
      </div>

      {/* <Separator /> */}

      <Button
        onClick={handleComplete}
        className="w-full"
        disabled={isLoading || availablePlayers.length < 6}
      >
        Start Match
      </Button>
    </div>
  );
}
