"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Match, Player, Team } from "@/lib/supabase/types";
import { Check } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type MatchSetupProps = {
  homeTeam: Team;
  awayTeam: Team;
  onTeamSelected: (teamId: string) => void;
};

export function MatchManagedTeamSetup({
  homeTeam,
  awayTeam,
  onTeamSelected,
}: MatchSetupProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Managed Team</h2>
        <RadioGroup
          onValueChange={onTeamSelected}
          className="flex flex-col space-y-1"
        >
          <Label className="text-sm font-medium">
            <RadioGroupItem
              value={homeTeam.id}
              id="homeTeam"
              className="peer sr-only"
            />
            <div className="p-10 cursor-pointer flex-1 border border-gray-200 transition-colors rounded-lg peer-aria-checked:border-gray-900 peer-aria-checked:ring-gray-900 ring-1 ring-transparent w-full text-gray-500 flex items-center justify-center peer-aria-checked:text-gray-900 dark:border-gray-800 dark:peer-aria-checked:border-gray-50 dark:peer-aria-checked:ring-gray-50 dark:text-gray-400 dark:peer-aria-checked:text-gray-50">
              {homeTeam.name}
            </div>
          </Label>
          <Label className="text-sm font-medium">
            <RadioGroupItem
              value={awayTeam.id}
              id="awayTeam"
              className="peer sr-only"
            />
            <div className="p-10 cursor-pointer flex-1 border border-gray-200 transition-colors rounded-lg peer-aria-checked:border-gray-900 peer-aria-checked:ring-gray-900 ring-1 ring-transparent w-full text-gray-500 flex items-center justify-center peer-aria-checked:text-gray-900 dark:border-gray-800 dark:peer-aria-checked:border-gray-50 dark:peer-aria-checked:ring-gray-50 dark:text-gray-400 dark:peer-aria-checked:text-gray-50">
              {awayTeam.name}
            </div>
          </Label>
        </RadioGroup>
      </div>
    </div>
  );
}
