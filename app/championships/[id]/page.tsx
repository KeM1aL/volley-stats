"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useChampionshipApi } from "@/hooks/use-championship-api";
import { Championship, Season } from "@/lib/types";
import { LoadingPage } from "@/components/loading-page";
import { MatchHistoryTable } from "@/components/matches/history/match-history-table";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Filter as ApiFilter, Sort } from "@/lib/api/types";
import { useMatchApi } from "@/hooks/use-match-api";
import { Match, Team, Club } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClubSelect } from "@/components/clubs/club-select";
import { TeamSelect } from "@/components/teams/team-select";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { useToast } from "@/hooks/use-toast";
import { useClubApi } from "@/hooks/use-club-api";
import { useSeasonApi } from "@/hooks/use-season-api";
import { TeamStats } from "@/components/matches/history/team-stats";
import { StatisticsDialog } from "@/components/matches/history/statistics-dialog";
import { BarChart3, Filter, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChampionshipTeamsSummary } from "@/components/championships/championship-teams-summary";
import { ChampionshipTeamsList } from "@/components/championships/championship-teams-list";
import { useTeamApi } from "@/hooks/use-team-api";

const lastSeptember = new Date();
if (lastSeptember.getMonth() < 8) {
  lastSeptember.setFullYear(lastSeptember.getFullYear() - 1);
}
lastSeptember.setMonth(8);
lastSeptember.setDate(1);

export default function ChampionshipDetailPage() {
  const t = useTranslations("championships");
  const tc = useTranslations("common");
  const params = useParams();
  const championshipId = params.id as string;
  const championshipApi = useChampionshipApi();
  const matchApi = useMatchApi();
  const { toast } = useToast();

  const [championship, setChampionship] = useState<Championship | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: lastSeptember,
  });
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const teamApi = useTeamApi();

  useEffect(() => {
    const fetchChampionship = async () => {
      if (championshipId) {
        const data = await championshipApi.getChampionships([
          { field: "id", operator: "eq", value: championshipId },
        ]);
        setChampionship(data?.[0] || null);
      }
    };
    fetchChampionship();
  }, [championshipId, championshipApi]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters: ApiFilter[] = [];

        filters.push({
          field: "championship_id",
          operator: "eq",
          value: championshipId,
        });

        if (selectedTeam) {
          filters.push({
            operator: "or",
            value: `home_team_id.eq.${selectedTeam.id},away_team_id.eq.${selectedTeam.id}`,
          });
        }

        if (selectedClub) {
          // filters.push({
          //   field: "home_team.club_id",
          //   operator: "eq",
          //   value: selectedClub.id,
          // });
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
        const sort: Sort<Match>[] = [{ field: "date", direction: "asc" }];
        const matchesData = await matchApi.getMatchs(filters, sort, joins);
        setMatches(matchesData);
      } catch (error) {
        console.error("Error loading data:", error);
        setError(
          error instanceof Error ? error : new Error(tc('errors.failedLoadData'))
        );
        toast({
          variant: "destructive",
          title: t("errors.loadMatches"),
          description: t("errors.loadMatchesDesc"),
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (championshipId) {
      loadData();
    }
  }, [
    championshipId,
    selectedTeam,
    dateRange,
    toast,
    matchApi,
    selectedClub,
    t,
  ]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!championshipId) return;

      setIsLoadingTeams(true);
      try {
        const filters: ApiFilter[] = [
          {
            field: "championship_id",
            operator: "eq",
            value: championshipId
          },
          {
            field: "status",
            operator: "eq",
            value: "active"
          }
        ];
        const joins = ["championships", "clubs"];
        const teamsData = await teamApi.getTeams(filters, undefined, joins);
        setTeams(teamsData || []);
      } catch (error) {
        console.error("Error loading teams:", error);
        toast({
          variant: "destructive",
          title: t("errors.loadTeams"),
          description: t("errors.loadTeamsDesc"),
        });
      } finally {
        setIsLoadingTeams(false);
      }
    };

    fetchTeams();
  }, [championshipId, teamApi, toast, t]);

  const handleTeamChange = (team: Team | null) => {
    setSelectedTeam(team);
    if (team && team.club_id) {
      const clubApi = useClubApi();
      clubApi.getClubById(team.club_id).then(setSelectedClub);
    } else {
      setSelectedClub(null);
    }
  };

  const handleRefresh = async () => {
    if (!championship) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(
        `/api/import/ffvb`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            championshipId: championship.id,
            seasonId: championship.season_id
          })
        }
      );
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || t("errors.refreshFailed"));
      }
      toast({ title: t("toast.success"), description: t("toast.matchesRefreshedSuccess") });
    } catch (error: any) {
      toast({ title: t("errors.loadMatches"), description: error.message, variant: "destructive" });
    }
    setIsRefreshing(false);
  };

  if (isLoading && !championship) {
    return <LoadingPage />;
  }

  if (!championship) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">{t("details.notFound")}</h1>
        <p>{t("details.notFoundDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t("details.information")}: {championship.name}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("labels.format")}: {championship.match_formats?.format} | {t("labels.gender")}: {championship.gender} | {t("labels.ageCategory")}: {championship.age_category}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 sm:mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? t("actions.refreshing") : t("actions.refresh")}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Filter className="h-4 w-4 mr-1 sm:mr-2" />
            {t("filters.title")}
          </Button>
        </div>
      </div>

      {/* Teams Section */}
      <div className="space-y-4">
        <ChampionshipTeamsSummary
          teams={teams}
          championshipId={championship.id}
        />

        <ChampionshipTeamsList
          teams={teams}
          isLoading={isLoadingTeams}
          championshipId={championship.id}
        />
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>{t("labels.club")}</Label>
                  <ClubSelect
                    value={selectedClub}
                    onChange={setSelectedClub}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("labels.team")}</Label>
                  <TeamSelect
                    value={selectedTeam}
                    onChange={handleTeamChange}
                    clubId={selectedClub?.id?.toString()}
                    championshipId={championship.id}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("labels.dateRange")}</Label>
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
        <div className="grid md:grid-cols-3 gap-6">
          <TeamStats teamId={selectedTeam.id} matches={matches} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("labels.matches")}</CardTitle>
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
    </div>
  );
}
