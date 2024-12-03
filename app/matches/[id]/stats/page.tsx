"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDb } from "@/components/providers/database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  Match,
  Player,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/supabase/types";
import { toast } from "@/hooks/use-toast";
import { SetBreakdown } from "@/components/matches/stats/set-breakdown";
import { PlayerPerformance } from "@/components/matches/stats/player-performance";
import { ScoreProgression } from "@/components/matches/stats/score-progression";
import { TeamPerformance } from "@/components/matches/stats/team-performance";
import { MatchAnalysis } from "@/components/matches/stats/match-analysis";

export default function MatchStatsPage() {
  const { id: matchId } = useParams();
  const searchParams = useSearchParams();
  const { db } = useDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!db) return;

      try {
        const [matchDoc, pointDocs, statDocs, setDocs, playerDocs] =
          await Promise.all([
            db.matches.findOne(matchId as string).exec(),
            db.score_points
              .find({
                selector: {
                  match_id: matchId as string,
                },
                sort: [{ created_at: "asc" }],
              })
              .exec(),
            db.player_stats
              .find({
                selector: {
                  match_id: matchId as string,
                },
                sort: [{ created_at: "asc" }],
              })
              .exec(),
            db.sets
              .find({
                selector: {
                  match_id: matchId as string,
                },
                sort: [{ created_at: "asc" }],
              })
              .exec(),
            db.players.find().exec(),
          ]);

        if (matchDoc) {
          const match = matchDoc.toMutableJSON() as Match;
          setMatch(match);
          const teamPlayers = playerDocs.filter(
            (doc) =>
              doc.team_id === matchDoc.home_team_id ||
              doc.team_id === matchDoc.away_team_id
          );
          setPlayers(teamPlayers.map((doc) => doc.toJSON()));

          const teamDocs = await db.teams
            .findByIds([match.home_team_id, match.away_team_id])
            .exec();

          if (!teamDocs || teamDocs.size !== 2) {
            throw new Error("Teams not found");
          }

          const teams = Array.from(teamDocs.values()).map((doc) =>
            doc.toJSON()
          );

          const managedTeamParam = searchParams.get("team");
          if (!managedTeamParam) {
            throw new Error("Please select your managed team");
          }

          const teamId = searchParams.get("team");
          if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
            throw new Error("Managed Team not found");
          }

          setManagedTeam(teams.find((team) => team.id === teamId));
          setOpponentTeam(teams.find((team) => team.id !== teamId));
        }
        setPoints(pointDocs.map((doc) => doc.toJSON()));
        setStats(statDocs.map((doc) => doc.toJSON()));
        setSets(setDocs.map((doc) => doc.toJSON()));
      } catch (error) {
        console.error("Failed to load match data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load match data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [db, matchId]);

  const exportToPDF = async () => {
    const doc = new jsPDF();

    // Add match details
    doc.setFontSize(20);
    doc.text("Match Report", 20, 20);

    if (match) {
      doc.setFontSize(12);
      doc.text(`Date: ${new Date(match.date).toLocaleDateString()}`, 20, 40);
      doc.text(`Score: ${match.home_score} - ${match.away_score}`, 20, 50);
    }

    // Add more sections...

    doc.save("match-report.pdf");
  };

  const exportToCSV = () => {
    // Convert match data to CSV format
    const csvContent =
      "data:text/csv;charset=utf-8," +
      // Add CSV data here
      "Match Statistics";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "match-stats.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareStats = async () => {
    try {
      await navigator.share({
        title: "Match Statistics",
        text: "Check out the statistics from our latest match!",
        url: window.location.href,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!match) {
    return <div>Match not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Match Statistics</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={shareStats}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sets">Sets</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="progression">Progression</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Final Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-center">
                      {match.home_score} - {match.away_score}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Match Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p>Total Sets: {sets.length}</p>
                      <p>Total Points: {points.length}</p>
                      <p>Duration: {sets.length * 25} minutes</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sets">
              <SetBreakdown
                match={match}
                sets={sets}
                points={points}
                managedTeam={managedTeam!}
                opponentTeam={opponentTeam!}
              />
            </TabsContent>

            <TabsContent value="players">
              <PlayerPerformance
                managedTeam={managedTeam!}
                opponentTeam={opponentTeam!}
                players={players}
                stats={stats}
                sets={sets}
              />
            </TabsContent>

            <TabsContent value="progression">
              <ScoreProgression match={match} points={points} />
            </TabsContent>

            <TabsContent value="team">
              <TeamPerformance
                match={match}
                sets={sets}
                points={points}
                stats={stats}
              />
            </TabsContent>

            <TabsContent value="analysis">
              <MatchAnalysis
                match={match}
                sets={sets}
                points={points}
                stats={stats}
                players={players}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
