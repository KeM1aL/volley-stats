"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

const lastSeptember = new Date();
if (lastSeptember.getMonth() < 8) {
  lastSeptember.setFullYear(lastSeptember.getFullYear() - 1);
}
lastSeptember.setMonth(8);
lastSeptember.setDate(1);

export default function ChampionshipDetailPage() {
  const params = useParams();
  const championshipId = Number(params.id);
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
          error instanceof Error ? error : new Error("Failed to load data")
        );
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load matches. Please try refreshing the page.",
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
  ]);

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
        throw new Error(error || "Failed to refresh matches");
      }
      toast({ title: "Success", description: "Matches have been refreshed successfully." });
    } catch (error: any) { 
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsRefreshing(false);
  };

  if (isLoading && !championship) {
    return <LoadingPage />;
  }

  if (!championship) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Championship Not Found</h1>
        <p>The requested championship could not be found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            Championship: {championship.name}
          </h1>
          <p className="text-muted-foreground">
            Format: {championship.format} | Gender: {championship.gender} | Age
            Category: {championship.age_category}
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Club</Label>
                  <ClubSelect
                    value={selectedClub}
                    onChange={setSelectedClub}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>Team</Label>
                  <TeamSelect
                    value={selectedTeam}
                    onChange={handleTeamChange}
                    clubId={selectedClub?.id?.toString()}
                    championshipId={championship.id}
                    isClearable
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date range</Label>
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
          <CardTitle>Matches</CardTitle>
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
