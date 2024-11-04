"use client";

import { useState } from "react";
import { Match, Set } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatType, StatResult } from "@/lib/types";

type StatTrackerProps = {
  match: Match;
  set: Set
};

export function StatTracker({ match, set }: StatTrackerProps) {
  const { db } = useDb();
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [selectedStatType, setSelectedStatType] = useState<StatType | "">("");
  const [isRecording, setIsRecording] = useState(false);

  const recordStat = async (result: StatResult) => {
    if (!selectedPlayer || !selectedStatType) return;

    setIsRecording(true);
    try {
      await db?.player_stats.insert({
        id: crypto.randomUUID(),
        set_id: set.id,
        match_id: match.id,
        player_id: selectedPlayer,
        stat_type: selectedStatType,
        result,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to record stat:", error);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      <CardHeader>
        <CardTitle>Stat Tracker</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedPlayer}>
          <SelectTrigger>
            <SelectValue placeholder="Select player" />
          </SelectTrigger>
          <SelectContent>
            {/* Add player selection items */}
          </SelectContent>
        </Select>

        <Select onValueChange={(value) => setSelectedStatType(value as StatType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select stat type" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(StatType).map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-3 gap-4">
          <Button
            onClick={() => recordStat(StatResult.SUCCESS)}
            disabled={!selectedPlayer || !selectedStatType || isRecording}
            className="w-full"
            variant="default"
          >
            Success
          </Button>
          <Button
            onClick={() => recordStat(StatResult.ERROR)}
            disabled={!selectedPlayer || !selectedStatType || isRecording}
            className="w-full"
            variant="destructive"
          >
            Error
          </Button>
          <Button
            onClick={() => recordStat(StatResult.ATTEMPT)}
            disabled={!selectedPlayer || !selectedStatType || isRecording}
            className="w-full"
            variant="secondary"
          >
            Attempt
          </Button>
        </div>
      </CardContent>
    </div>
  );
}