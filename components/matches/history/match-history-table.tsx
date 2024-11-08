"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
  Upload,
  Volleyball,
  Pencil,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Match } from "@/lib/supabase/types";
import { MatchStatus } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SortField = "date" | "opponent" | "score";
type SortDirection = "asc" | "desc";

type MatchHistoryTableProps = {
  matches: Match[];
  onViewStats: (match: Match) => void;
  onStart: (match: Match) => void;
  onEdit: (match: Match) => void;
  error?: Error | null;
  isLoading?: boolean;
};

export function MatchHistoryTable({
  matches,
  onViewStats,
  onStart,
  onEdit,
  error,
  isLoading,
}: MatchHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortMatches = (a: Match, b: Match) => {
    switch (sortField) {
      case "date":
        return sortDirection === "asc"
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      case "score":
        const aScore = Math.abs(a.home_score - a.away_score);
        const bScore = Math.abs(b.home_score - b.away_score);
        return sortDirection === "asc" ? aScore - bScore : bScore - aScore;
      default:
        return 0;
    }
  };

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load matches. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No matches found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer"
            onClick={() => toggleSort("date")}
          >
            <div className="flex items-center gap-2">
              Date
              <SortIcon field="date" />
            </div>
          </TableHead>
          <TableHead>Teams</TableHead>
          <TableHead
            className="cursor-pointer"
            onClick={() => toggleSort("score")}
          >
            <div className="flex items-center gap-2">
              Score
              <SortIcon field="score" />
            </div>
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...matches].sort(sortMatches).map((match) => (
          <TableRow key={match.id}>
            <TableCell>{new Date(match.date).toLocaleDateString()}</TableCell>
            <TableCell>
              {match.home_team?.name || "Unknown"} vs{" "}
              {match.away_team?.name || "Unknown"}
            </TableCell>
            <TableCell>
              {match.home_score} - {match.away_score}
            </TableCell>
            <TableCell>
              <span className="capitalize">{match.status}</span>
            </TableCell>
            <TableCell>
              {(() => {
                switch (match.status) {
                  case MatchStatus.UPCOMING:
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onStart(match)}
                      >
                        <Volleyball className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    );
                  case MatchStatus.COMPLETED:
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewStats(match)}
                      >
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Stats
                      </Button>
                    );
                  case MatchStatus.LIVE:
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(match)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    );
                  default:
                    return null;
                }
              })()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
