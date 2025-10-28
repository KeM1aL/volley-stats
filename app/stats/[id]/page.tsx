"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type {
  Match,
  TeamMember,
  PlayerStat,
  ScorePoint,
  Set,
  Team,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { SetBreakdown } from "@/components/matches/stats/set-breakdown";
import { PlayerPerformance } from "@/components/matches/stats/player-performance";
import { ScoreProgression } from "@/components/matches/stats/score-progression";
import { TeamPerformance } from "@/components/matches/stats/team-performance";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";
import { MatchScoreDetails } from "@/components/matches/match-score-details";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { supabase } from "@/lib/supabase/client";
import { MatchOverview } from "@/components/matches/stats/match-overview";
import { PdfExportHandle } from "@/lib/pdf/types";

export default function MatchStatsPage() {
  const { id: matchId } = useParams();
  const { isOnline, wasOffline } = useOnlineStatus();
  const searchParams = useSearchParams();
  const { localDb: db } = useLocalDb();
  const [match, setMatch] = useState<Match | null>(null);
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [points, setPoints] = useState<ScorePoint[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [players, setPlayers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isPdfGenerating, setIsPdfGenerating] = useState(false); // State to indicate if PDF generation is in progress

  const overviewRef = useRef<PdfExportHandle>(null);
  const setBreakdownRef = useRef<PdfExportHandle>(null);
  const playerPerformanceRef = useRef<PdfExportHandle>(null);
  const scoreProgressionRef = useRef<PdfExportHandle>(null);
  const teamPerformanceRef = useRef<PdfExportHandle>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .eq("id", matchId as string)
          .single();

        if (matchError) throw matchError;
        setMatch(matchData);

        const { data: setsData, error: setsError } = await supabase
          .from("sets")
          .select("*")
          .eq("match_id", matchId as string)
          .order("set_number", { ascending: true });
        if (setsError) throw setsError;
        setSets(setsData);

        const { data: playerStatsData, error: playerStatsError } =
          await supabase
            .from("player_stats")
            .select("*")
            .eq("match_id", matchId as string)
            .order("created_at", { ascending: true });
        if (playerStatsError) throw playerStatsError;
        setStats(playerStatsData);

        const { data: scorePointsData, error: scorePointsError } =
          await supabase
            .from("score_points")
            .select("*")
            .eq("match_id", matchId as string)
            .order("created_at", { ascending: true });
        if (scorePointsError) throw scorePointsError;
        setPoints(scorePointsData);

        const managedTeamParam = searchParams.get("team");
        if (!managedTeamParam) {
          throw new Error("Please select your managed team");
        }

        const teamId = searchParams.get("team");

        if (
          teamId !== matchData.home_team_id &&
          teamId !== matchData.away_team_id
        ) {
          throw new Error("Managed Team not found");
        }

        const playerIds =
          teamId === matchData.home_team_id
            ? matchData.home_available_players
            : matchData.away_available_players;
        const {
          data: availablePlayersData,
          error: availablePlayersError,
        } = // @ts-ignore
          await supabase
            .from("team_members")
            .select("*")
            .in("id", playerIds as string[]);
        if (availablePlayersError) throw availablePlayersError;
        setPlayers(availablePlayersData);

        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("*")
          .in("id", [matchData.home_team_id, matchData.away_team_id]);
        if (teamsError) throw teamsError;
        setManagedTeam(teamsData.find((team) => team.id === teamId));
        setOpponentTeam(teamsData.find((team) => team.id !== teamId));
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

    const loadLocalData = async () => {
      if (!db) return;

      try {
        setIsLoading(true);
        const [matchDoc, pointDocs, statDocs, setDocs] = await Promise.all([
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
        ]);
        if (!matchDoc) {
          throw new Error("Match not found");
        }
        const match = matchDoc.toMutableJSON() as Match;
        const points = pointDocs.map((doc) => doc.toJSON()) as ScorePoint[];
        const stats = statDocs.map((doc) => doc.toJSON()) as PlayerStat[];
        const sets = setDocs.map((doc) => doc.toJSON()) as Set[];

        setMatch(match);
        setPoints(points);
        setStats(stats);
        setSets(sets);

        const managedTeamParam = searchParams.get("team");
        if (!managedTeamParam) {
          throw new Error("Please select your managed team");
        }

        const teamId = searchParams.get("team");

        if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
          throw new Error("Managed Team not found");
        }

        const playerIds =
          teamId === match.home_team_id
            ? match.home_available_players
            : match.away_available_players; // @ts-ignore
        const availablePlayerDocs = await db.team_members
          .findByIds(playerIds as string[])
          .exec();
        if (availablePlayerDocs) {
          setPlayers(
            Array.from(availablePlayerDocs.values())
              .map((doc) => doc.toJSON())
              .sort((a, b) => a.number - b.number)
          );
        }

        const teamDocs = await db.teams
          .findByIds([match.home_team_id, match.away_team_id])
          .exec();

        if (!teamDocs || teamDocs.size !== 2) {
          throw new Error("Teams not found");
        }

        const teams = Array.from(teamDocs.values()).map((doc) => doc.toJSON());

        setManagedTeam(teams.find((team) => team.id === teamId));
        setOpponentTeam(teams.find((team) => team.id !== teamId));
      } catch (error) {
        console.error("Failed to load local match data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load local match data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOnline) {
      loadData();
    } else {
      loadLocalData();
    }
  }, [db, matchId, isOnline]);

  const exportToPDF = async () => {
    if (!match || isPdfGenerating) return;

    setIsPdfGenerating(true);
    toast({
      title: "Generating PDF...",
      description: "Please wait while your match statistics are being compiled.",
    });

    const doc = new jsPDF("p", "pt", "a4");
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- Title Page ---
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Match Statistics", pageWidth / 2, 60, { align: "center" });

    if (managedTeam && opponentTeam) {
      doc.setFontSize(18);
      doc.setFont("helvetica", "normal");
      doc.text(`${managedTeam.name} vs ${opponentTeam.name}`, pageWidth / 2, 90, {
        align: "center",
      });
    }

    doc.setFontSize(12);
    doc.text(new Date(match.date).toLocaleDateString(), pageWidth / 2, 110, {
      align: "center",
    });

    const componentsToExport = [
      { ref: overviewRef, title: "Overview", tab : "overview" },
      { ref: scoreProgressionRef, title: "Score Progression", tab : "scores"},
      { ref: setBreakdownRef, title: "Set Breakdown", tab : "sets"},
      { ref: playerPerformanceRef, title: "Player Performance", tab : "players"},
      { ref: teamPerformanceRef, title: "Team Performance", tab : "team"},
    ];

    const initialTab = activeTab;

    try {
      for (const { ref, title, tab } of componentsToExport) {
        setActiveTab(tab);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (ref.current) {
          await ref.current.generatePdfContent(doc, margin, sets, title);
        } else {
          console.warn(
            `Ref for ${title} not found. Skipping PDF generation for this component.`
          );
        }
      }

      doc.save(`match-stats-${matchId}.pdf`);
      toast({
        title: "PDF Generated!",
        description: "Your match statistics PDF has been downloaded.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: "There was an error generating the PDF.",
      });
    } finally {
      setIsPdfGenerating(false);
      setActiveTab(initialTab);
    }
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
          {/* <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button> */}
          <Button
            variant="outline"
            onClick={exportToPDF}
            disabled={isPdfGenerating}
          >
            <Download className="h-4 w-4 mr-2" />
            {isPdfGenerating ? "Generating..." : "Export PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={shareStats}
            disabled={isPdfGenerating}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="scores">Scores</TabsTrigger>
              <TabsTrigger value="sets">Sets</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" id="overview-section" className="space-y-4" >
              {match && managedTeam && opponentTeam && (
                <MatchOverview
                  ref={overviewRef}
                  match={match}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                  points={points}
                  stats={stats}
                  sets={sets}
                  players={players}
                  isPdfGenerating={isPdfGenerating}
                />
              )}
            </TabsContent>

            <TabsContent value="sets" id="sets-section">
              {match && managedTeam && opponentTeam && (
                <SetBreakdown
                  ref={setBreakdownRef}
                  match={match}
                  sets={sets}
                  points={points}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                  isPdfGenerating={isPdfGenerating}
                />
              )}
            </TabsContent>

            <TabsContent value="players" id="players-section">
              {match && managedTeam && opponentTeam && (
                <PlayerPerformance
                  ref={playerPerformanceRef}
                  match={match}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                  players={players}
                  stats={stats}
                  sets={sets}
                  isPdfGenerating={isPdfGenerating}
                />
              )}
            </TabsContent>

            <TabsContent value="scores" id="scores-section">
              {match && (
                <ScoreProgression
                  ref={scoreProgressionRef}
                  match={match}
                  points={points}
                  sets={sets}
                  isPdfGenerating={isPdfGenerating}
                />
              )}
            </TabsContent>

            <TabsContent value="team">
              <TeamPerformance
                ref={teamPerformanceRef}
                match={match}
                managedTeam={managedTeam!}
                sets={sets}
                points={points}
                stats={stats}
                players={players}
                isPdfGenerating={isPdfGenerating}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
