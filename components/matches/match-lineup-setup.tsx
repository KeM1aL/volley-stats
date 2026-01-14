"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Match, TeamMember, Team } from "@/lib/types";
import { Check } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type MatchSetupProps = {
  match: Match;
  players: TeamMember[]
  availablePlayers: string[]
  setAvailablePlayers: Dispatch<SetStateAction<string[]>>
};

export function MatchLineupSetup({ match, players, availablePlayers, setAvailablePlayers }: MatchSetupProps) {
  const [isLoading, setIsLoading] = useState(false);

  const sortPlayers = (a: TeamMember, b: TeamMember) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();

    if (aLower < bLower) return -1;
    if (aLower > bLower) return 1;
    return 0;
  };

  const togglePlayerAvailability = (player: TeamMember) => {
    if (availablePlayers.includes(player.id)) {
      setAvailablePlayers(availablePlayers.filter((id) => id !== player.id));
    } else {
      setAvailablePlayers([...availablePlayers, player.id]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Match Roster</h2>
        <div className="grid grid-cols-4 gap-4">
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

      
    </div>
  );
}
