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
import { PlayerPosition } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Set } from "@/lib/supabase/types";

type SetSetupProps = {
  matchId: string;
  onComplete: (set: Set) => void;
};

export function SetSetup({ matchId, onComplete }: SetSetupProps) {
  const { db } = useDb();
  const [homeLineup, setHomeLineup] = useState<Record<PlayerPosition, string>>({} as Record<PlayerPosition, string>);
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save lineups and start the set
      const setDoc = await db?.sets.findOne(setId).update({
        $set: {
          status: "live",
          home_lineup: homeLineup,
        },
      });
      onComplete();
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

      {/* <Separator /> */}

      <Button
        onClick={handleComplete}
        className="w-full"
        disabled={isLoading}
      >
        Start Set
      </Button>
    </div>
  );
}