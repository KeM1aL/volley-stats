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
import { Match, Team } from "@/lib/types";
import { MatchStatus } from "@/lib/enums";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MatchStartDialog from "../match-start-dialog";
import MatchEditDialog from "../match-edit-dialog";
import MatchStatsDialog from "../match-stats-dialog";
import MatchScoreDialog from "../match-score-dialog";
import { useAuth } from "@/contexts/auth-context";

type SortField = "date" | "opponent" | "score";
type SortDirection = "asc" | "desc";

type MatchHistoryTableProps = {
  matches: Match[];
  error?: Error | null;
  isLoading?: boolean;
};

export function MatchHistoryTable({
  matches,
  error,
  isLoading,
}: MatchHistoryTableProps) {
  const { user } = useAuth();
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const isMemberOfTeamOrClub = (match: Match) => {
    if (!user) return false;

    const isHomeTeamMember = user.teamMembers?.some(
      (member) => member.team_id === match.home_team_id
    );
    const isAwayTeamMember = user.teamMembers?.some(
      (member) => member.team_id === match.away_team_id
    );

    const isHomeClubMember = user.clubMembers?.some(
      (member) => member.club_id === match.home_team?.club_id
    );
    const isAwayClubMember = user.clubMembers?.some(
      (member) => member.club_id === match.away_team?.club_id
    );

    return isHomeTeamMember || isAwayTeamMember || isHomeClubMember || isAwayClubMember;
  };

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
          {user && <TableHead className="w-[100px]">Actions</TableHead>}
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
            {user && isMemberOfTeamOrClub(match) && (
              <TableCell>
                <div className="flex gap-2">
                  {(() => {
                    switch (match.status) {
                      case MatchStatus.UPCOMING:
                        return <MatchStartDialog match={match} />;
                      case MatchStatus.COMPLETED:
                        return <MatchStatsDialog match={match} />;
                      case MatchStatus.LIVE:
                        return <><MatchEditDialog match={match} /> <MatchScoreDialog match={match} /></>;
                      default:
                        return null;
                    }
                  })()}
                  
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
