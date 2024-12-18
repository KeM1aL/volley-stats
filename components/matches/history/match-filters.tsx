"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Team } from "@/lib/types";
import { DateRange } from "react-day-picker";

type MatchFiltersProps = {
  teams: Team[];
  selectedTeam: string | null;
  onTeamChange: (teamId: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  opponent: string | null;
  onOpponentChange: (teamId: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MatchFilters({
  teams,
  selectedTeam,
  onTeamChange,
  dateRange,
  onDateRangeChange,
  opponent,
  onOpponentChange,
  open,
  onOpenChange,
}: MatchFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Matches</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Team</Label>
            <Select
              value={selectedTeam || undefined}
              onValueChange={onTeamChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Opponent</Label>
            <Select
              value={opponent || undefined}
              onValueChange={(value) => onOpponentChange(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select opponent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null as unknown as string}>Any opponent</SelectItem>
                {teams
                  .filter((team) => team.id !== selectedTeam)
                  .map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date Range</Label>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}