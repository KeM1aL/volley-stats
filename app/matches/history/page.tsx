"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { BarChart3, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchHistoryTable } from "@/components/matches/history/match-history-table";
import { MatchFilters } from "@/components/matches/history/match-filters";
import { TeamStats } from "@/components/matches/history/team-stats";
import { StatisticsDialog } from "@/components/matches/history/statistics-dialog";
import { CompareDialog } from "@/components/matches/history/compare-dialog";
import { useDb } from "@/components/providers/database-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Match, Team } from "@/lib/supabase/types";

export default function MatchHistoryPage() {
  const router = useRouter();
  const { db } = useDb();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [opponent, setOpponent] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [compareMatches, setCompareMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const onMatchStarted = (matchId: string) => {
    router.push(`/matches/${matchId}/start`);
  };

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      
      // Load teams first
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*");

      if (teamsError) throw teamsError;
      setTeams(teamsData);

      // If a team is selected, load its matches
      if (selectedTeam) {
        let query = supabase
          .from("matches")
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(*),
            away_team:teams!matches_away_team_id_fkey(*)
          `)
          .or(`home_team_id.eq.${selectedTeam},away_team_id.eq.${selectedTeam}`);

        // Apply date range filter
        if (dateRange?.from) {
          query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
        }
        if (dateRange?.to) {
          query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
        }

        // Apply opponent filter
        if (opponent) {
          query = query.or(`home_team_id.eq.${opponent},away_team_id.eq.${opponent}`);
        }

        const { data: matchesData, error: matchesError } = await query;
        
        if (matchesError) throw matchesError;
        setMatches(matchesData);
      }

      setIsLoading(false);
    };

    loadData();
  }, [db, selectedTeam, dateRange, opponent]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Match History</h1>
          <p className="text-muted-foreground">
            View and analyze match statistics
          </p>
        </div>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          {matches.length >= 2 && (
            <Button
              onClick={() => setCompareMatches(matches.slice(0, 2))}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare Matches
            </Button>
          )}
        </div>
      </div>

      <MatchFilters
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        opponent={opponent}
        onOpponentChange={setOpponent}
        open={showFilters}
        onOpenChange={setShowFilters}
      />

      {selectedTeam && (
        <div className="grid md:grid-cols-3 gap-6">
          <TeamStats teamId={selectedTeam} matches={matches} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchHistoryTable
            matches={matches}
            onViewStats={setSelectedMatch}
            onMatchStarted={onMatchStarted}
          />
        </CardContent>
      </Card>

      <StatisticsDialog
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />

      <CompareDialog
        matches={compareMatches}
        onClose={() => setCompareMatches([])}
      />
    </div>
  );
}