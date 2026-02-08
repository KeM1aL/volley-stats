"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { BarChart3, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchHistoryTable } from "@/components/matches/history/match-history-table";
import { TeamStats } from "@/components/matches/history/team-stats";
import { StatisticsDialog } from "@/components/matches/history/statistics-dialog";
import { NewMatchDialog } from "@/components/matches/new-match-dialog";
import { ClubSelect } from "@/components/clubs/club-select";
import { ChampionshipSelect } from "@/components/championships/championship-select";
import { TeamSelect } from "@/components/teams/team-select";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Match, Team, Club, Championship } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useClubApi } from "@/hooks/use-club-api";
import { useMatchApi } from "@/hooks/use-match-api";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Filter as ApiFilter, Sort } from "@/lib/api/types";
import { useTranslations } from "next-intl";

const lastSeptember = new Date();
if (lastSeptember.getMonth() < 8) {
  lastSeptember.setFullYear(lastSeptember.getFullYear() - 1);
}
lastSeptember.setMonth(8);
lastSeptember.setDate(1);

export default function MatchPage() {
  const t = useTranslations('matches');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: lastSeptember
  });
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedChampionship, setSelectedChampionship] =
    useState<Championship | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [newMatchDialogOpen, setNewMatchDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const matchApi = useMatchApi();

  // Apply favorites on mount if no manual filters set
  useMemo(() => {
    if (!user) return;

    const hasManualFilters = selectedTeam || selectedClub || selectedChampionship;

    if (!hasManualFilters) {
      if (user.profile.favorite_team) {
        setSelectedTeam(user.profile.favorite_team);
      } else if (user.profile.favorite_club) {
        setSelectedClub(user.profile.favorite_club);
      }
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      // Don't load if no favorite and no filters set
      const hasFavorite = user?.profile.favorite_team_id || user?.profile.favorite_club_id;
      const hasFilters = selectedTeam || selectedClub || selectedChampionship;

      if (!hasFavorite && !hasFilters) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
        try {
          const filters: ApiFilter[] = [];

          if (selectedTeam) {
            filters.push({
              operator: "or",
              value: `home_team_id.eq.${selectedTeam.id},away_team_id.eq.${selectedTeam.id}`,
            });
          }

          if (selectedChampionship) {
            filters.push({
              field: "championship_id",
              operator: "eq",
              value: selectedChampionship.id,
            });
          }

          if (dateRange?.from) {
            filters.push({
              field: "date",
              operator: "gte",
              value: format(dateRange.from, "yyyy-MM-dd"),
            });
          }

          if (dateRange?.to) {
            filters.push({
              field: "date",
              operator: "lte",
              value: format(dateRange.to, "yyyy-MM-dd"),
            });
          }

          const joins = [
            "home_team:teams!matches_home_team_id_fkey",
            "away_team:teams!matches_away_team_id_fkey",
          ];
          const sort: Sort<Match>[] = [{ field: "date", direction: "desc" }];
          let matchesData = await matchApi.getMatchs(filters, sort, joins) as Match[];
          setMatches(matchesData);
        } catch (error) {
          console.error("Error loading data:", error);
          setError(
            error instanceof Error ? error : new Error(tc('errors.failedLoadData'))
          );
          toast({
            variant: "destructive",
            title: t('toast.error'),
            description: t('toast.loadError'),
          });
        } finally {
          setIsLoading(false);
        }
    };

    loadData();
  }, [selectedTeam, selectedClub, dateRange, toast, selectedChampionship, matchApi, user, refreshKey]);

  const handleTeamChange = (team: Team | null) => {
    setSelectedTeam(team);
    if (team && team.club_id) {
      const clubApi = useClubApi();
      clubApi.getClubById(team.club_id).then(setSelectedClub);
    } else {
      setSelectedClub(null);
    }
  };

  const handleClubChange = (club: Club | null) => {
    setSelectedClub(club);
  };

  const handleChampionshipChange = (championship: Championship | null) => {
    setSelectedChampionship(championship);
  };

  const handleMatchRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Filter className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('filters')}</span>
          </Button>
          <Button onClick={() => setNewMatchDialogOpen(true)} className="flex-1 sm:flex-none text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span>{t('newMatch')}</span>
          </Button>
        </div>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label>{t('filterLabels.championship')}</Label>
                  <ChampionshipSelect
                    value={selectedChampionship}
                    onChange={handleChampionshipChange}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('filterLabels.club')}</Label>
                  <ClubSelect
                    value={selectedClub}
                    onChange={handleClubChange}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('filterLabels.team')}</Label>
                  <TeamSelect
                    value={selectedTeam}
                    onChange={handleTeamChange}
                    clubId={selectedClub?.id?.toString()}
                    championshipId={selectedChampionship?.id}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('filterLabels.dateRange')}</Label>
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={setDateRange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {selectedTeam && (
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <TeamStats teamId={selectedTeam.id} matches={matches} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchHistoryTable
            matches={matches}
            error={error}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <StatisticsDialog
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      <NewMatchDialog
        open={newMatchDialogOpen}
        onOpenChange={setNewMatchDialogOpen}
        onSuccess={(matchId) => {
          handleMatchRefresh();
          toast({
            title: t('toast.success'),
            description: t('toast.matchCreated'),
          });
        }}
      />
    </div>
  );
}
