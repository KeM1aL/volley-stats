"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { BarChart3, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchHistoryTable } from "@/components/matches/history/match-history-table";
import { TeamStats } from "@/components/matches/history/team-stats";
import { StatisticsDialog } from "@/components/matches/history/statistics-dialog";
import { useLocalDb } from "@/components/providers/local-database-provider";
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
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useClubApi } from "@/hooks/use-club-api";
import { useMatchApi } from "@/hooks/use-match-api";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Filter as ApiFilter, Sort } from "@/lib/api/types";

const lastSeptember = new Date();
if (lastSeptember.getMonth() < 8) {
  lastSeptember.setFullYear(lastSeptember.getFullYear() - 1);
}
lastSeptember.setMonth(8);
lastSeptember.setDate(1);

export default function MatchPage() {
  const { toast } = useToast();
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
  const [showFilters, setShowFilters] = useState(true);

  const matchApi = useMatchApi();

  useEffect(() => {
    const loadData = async () => {
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
            description:
              "Failed to load matches. Please try refreshing the page.",
          });
        } finally {
          setIsLoading(false);
        }
    };

    loadData();
  }, [selectedTeam, dateRange, toast, selectedChampionship, matchApi]);

  const handleTeamChange = (team: Team | null) => {
    setSelectedTeam(team);
    if (team && team.club_id) {
      const clubApi = useClubApi();
      clubApi.getClubById(team.club_id).then(setSelectedClub);
    } else {
      setSelectedClub(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Matches</h1>
          <p className="text-muted-foreground">
            View and analyze match statistics
          </p>
        </div>
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/matches/new">
              <Plus className="h-4 w-4 mr-2" />
              New Match
            </Link>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label>Championship</Label>
                  <ChampionshipSelect
                    value={selectedChampionship}
                    onChange={setSelectedChampionship}
                    isClearable
                  />
                </div>
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
                    championshipId={selectedChampionship?.id}
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
