"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BarChart2,
  Upload,
  Volleyball,
  Pencil,
  Search,
  ArchiveRestore,
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
import { Badge } from "@/components/ui/badge";
import { Match, Team } from "@/lib/types";
import { MatchStatus } from "@/lib/enums";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import MatchStartDialog from "../match-start-dialog";
import MatchEditDialog from "../match-edit-dialog";
import MatchStatsDialog from "../match-stats-dialog";
import MatchScoreDialog from "../match-score-dialog";
import { useAuth } from "@/contexts/auth-context";
import { canManageMatch, canRemoveMatch } from "@/lib/matches/can-manage-match";
import { removalError } from "@/lib/matches/removal";
import { MatchRemovalAction } from "./match-removal-action";
import { useMatchApi } from "@/hooks/use-match-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { SyncFlag } from "@/components/sync/sync-flag";
import { useSyncStatus } from "@/hooks/use-sync-status";

type SortField = "date" | "opponent" | "score";
type SortDirection = "asc" | "desc";

type MatchHistoryTableProps = {
  matches: Match[];
  error?: Error | null;
  isLoading?: boolean;
  /** Called after a match was deleted, archived or restored (or the attempt failed): reload the list. */
  onChange?: () => void;
};

export function MatchHistoryTable({
  matches,
  error,
  isLoading,
  onChange,
}: MatchHistoryTableProps) {
  const t = useTranslations("matches");
  const te = useTranslations("enums");
  const { user } = useAuth();
  const matchApi = useMatchApi();
  const { toast } = useToast();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const syncStatus = useSyncStatus();
  const syncByMatch = useMemo(
    () => new Map((syncStatus?.matches ?? []).map((summary) => [summary.matchId, summary])),
    [syncStatus]
  );
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Must be declared before any early returns to satisfy Rules of Hooks.
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      switch (sortField) {
        case "date":
          return sortDirection === "asc"
            ? new Date(a.date).getTime() - new Date(b.date).getTime()
            : new Date(b.date).getTime() - new Date(a.date).getTime();
        case "score": {
          const aScore = Math.abs((a.home_score ?? 0) - (a.away_score ?? 0));
          const bScore = Math.abs((b.home_score ?? 0) - (b.away_score ?? 0));
          return sortDirection === "asc" ? aScore - bScore : bScore - aScore;
        }
        default:
          return 0;
      }
    });
  }, [matches, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRestore = async (match: Match) => {
    setRestoringId(match.id);
    try {
      await matchApi.restoreMatch(match.id);
      toast({ title: t("removal.toast.restored") });
    } catch (error) {
      console.error("Failed to restore match:", error);
      toast({
        variant: "destructive",
        title: t("toast.error"),
        description: t(`removal.errors.${removalError(error)}`),
      });
    } finally {
      setRestoringId(null);
      onChange?.();
    }
  };

  const hasActions = (match: Match) => canManageMatch(user, match) || canRemoveMatch(user, match);

  /** Start, edit or statistics for who manages the match; delete, archive or restore for who may remove it. */
  const renderActions = (match: Match) => {
    if (match.archived_at) {
      return canRemoveMatch(user, match) ? (
        <Button
          variant="outline"
          size="sm"
          disabled={restoringId === match.id}
          onClick={() => void handleRestore(match)}
          aria-label={t("removal.restoreAriaLabel", {
            home: match.home_team?.name ?? t("table.unknown"),
            away: match.away_team?.name ?? t("table.unknown"),
          })}
        >
          <ArchiveRestore className="h-4 w-4 mr-2" />
          {t("removal.restore")}
        </Button>
      ) : null;
    }
    return (
      <>
        {canManageMatch(user, match) &&
          (() => {
            switch (match.status) {
              case MatchStatus.UPCOMING:
                return <MatchStartDialog match={match} />;
              case MatchStatus.COMPLETED:
                return <MatchStatsDialog match={match} />;
              case MatchStatus.LIVE:
                return <MatchEditDialog match={match} />;
              default:
                return null;
            }
          })()}
        {canRemoveMatch(user, match) && <MatchRemovalAction match={match} onDone={() => onChange?.()} />}
      </>
    );
  };

  const archivedBadge = (match: Match) =>
    match.archived_at ? (
      <Badge variant="outline" className="ml-2">
        {t("removal.badge")}
      </Badge>
    ) : null;

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
          {t("errors.loadError")}
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
        title={t("history.noMatchesFound")}
        description={
          hasFavorite
            ? t("history.noMatchesWithFilters")
            : t("history.noFavoritesHint")
        }
        action={
          !hasFavorite
            ? {
                label: t("history.goToSettings"),
                href: "/settings"
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {sortedMatches.map((match) => (
          <div
            key={match.id}
            data-testid={match.archived_at ? "archived-match-row" : "match-row"}
            className={cn("border rounded-lg p-4 space-y-2", match.archived_at && "opacity-60")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {new Date(match.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <SyncFlag summary={syncByMatch.get(match.id)} />
                <span className="text-sm capitalize px-2 py-0.5 bg-muted rounded">
                  {te(`matchStatus.${match.status}`)}
                </span>
                {archivedBadge(match)}
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
            {hasActions(match) && (
              <div className="flex gap-2 pt-2 border-t">{renderActions(match)}</div>
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
                  {t("table.date")}
                  <SortIcon field="date" />
                </div>
              </TableHead>
              <TableHead>{t("table.teams")}</TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => toggleSort("score")}
              >
                <div className="flex items-center gap-2">
                  {t("table.score")}
                  <SortIcon field="score" />
                </div>
              </TableHead>
              <TableHead>{t("table.status")}</TableHead>
              {user && <TableHead className="w-[150px]">{t("table.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.map((match) => (
              <TableRow
                key={match.id}
                data-testid={match.archived_at ? "archived-match-row" : "match-row"}
                className={cn(match.archived_at && "opacity-60")}
              >
                <TableCell className="whitespace-nowrap">{new Date(match.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  {match.home_team?.name || t("table.unknown")} {t("table.vs")}{" "}
                  {match.away_team?.name || t("table.unknown")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {match.home_score} - {match.away_score}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span className="capitalize">{te(`matchStatus.${match.status}`)}</span>
                    <SyncFlag summary={syncByMatch.get(match.id)} />
                    {archivedBadge(match)}
                  </span>
                </TableCell>
                {hasActions(match) && (
                  <TableCell>
                    <div className="flex gap-2">{renderActions(match)}</div>
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
