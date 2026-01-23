"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
  Upload,
  Volleyball,
  Pencil,
  Search,
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
import { EmptyState } from "@/components/ui/empty-state";
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
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const isMemberOfTeamOrClub = (match: Match) => {
    if (!user) return false;

    if(match.home_team?.user_id === user.id || match.away_team?.user_id === user.id) {
      return true;
    }

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
        a.home_score = a.home_score || 0;
        a.away_score = a.away_score || 0;
        b.home_score = b.home_score || 0;
        b.away_score = b.away_score || 0;
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
    const hasFavorite = user?.profile.favorite_team_id || user?.profile.favorite_club_id;

    return (
      <EmptyState
        icon={<Search className="h-12 w-12" />}
        title="No matches found"
        description={
          hasFavorite
            ? "No matches found with current filters. Try adjusting your search criteria or date range."
            : "Set your favorite team or club in settings to see your matches by default, or use the filters above to find matches."
        }
        action={
          !hasFavorite
            ? {
                label: "Go to Settings",
                href: "/settings"
              }
            : undefined
        }
      />
    );
  }

  const sortedMatches = [...matches].sort(sortMatches);

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedMatches.map((match) => (
          <div
            key={match.id}
            className="border rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {new Date(match.date).toLocaleDateString()}
              </span>
              <span className="text-sm capitalize px-2 py-0.5 bg-muted rounded">
                {match.status}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate flex-1">
                  {match.home_team?.name || "Unknown"}
                </span>
                <span className="font-bold text-lg ml-2">{match.home_score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium truncate flex-1">
                  {match.away_team?.name || "Unknown"}
                </span>
                <span className="font-bold text-lg ml-2">{match.away_score}</span>
              </div>
            </div>
            {user && isMemberOfTeamOrClub(match) && (
              <div className="flex gap-2 pt-2 border-t">
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
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block w-full overflow-x-auto">
        <div className="inline-block min-w-full">
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
              {user && <TableHead className="w-[150px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.map((match) => (
              <TableRow key={match.id}>
                <TableCell className="whitespace-nowrap">{new Date(match.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  {match.home_team?.name || "Unknown"} vs{" "}
                  {match.away_team?.name || "Unknown"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
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
        </div>
      </div>
    </>
  );
}
