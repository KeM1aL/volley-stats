"use client";

import { useState } from "react";
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

type MatchSetupProps = {
  matchId: string;
  onComplete: () => void;
};

export function MatchSetup({ matchId, onComplete }: MatchSetupProps) {
  const { db } = useDb();
  const [homeLineup, setHomeLineup] = useState<Record<PlayerPosition, string>>({} as Record<PlayerPosition, string>);
  const [awayLineup, setAwayLineup] = useState<Record<PlayerPosition, string>>({}  as Record<PlayerPosition, string>);
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save lineups and start the match
      await db?.matches.findOne(matchId).update({
        $set: {
          status: "live",
          home_lineup: homeLineup,
          away_lineup: awayLineup,
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
        <h2 className="text-lg font-semibold mb-4">Home Team Lineup</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.values(PlayerPosition).map((position) => (
            <div key={position}>
              <Label>{position}</Label>
              <Select
                onValueChange={(value) =>
                  setHomeLineup((prev) => ({ ...prev, [position]: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${position}`} />
                </SelectTrigger>
                <SelectContent>
                  {/* Add player selection items */}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-4">Away Team Lineup</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.values(PlayerPosition).map((position) => (
            <div key={position}>
              <Label>{position}</Label>
              <Select
                onValueChange={(value) =>
                  setAwayLineup((prev) => ({ ...prev, [position]: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${position}`} />
                </SelectTrigger>
                <SelectContent>
                  {/* Add player selection items */}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={handleComplete}
        className="w-full"
        disabled={isLoading}
      >
        Start Match
      </Button>
    </div>
  );
}