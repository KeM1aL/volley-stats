"use client";

import { useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState("overview"); // State to manage active tab for export
  const [isPdfGenerating, setIsPdfGenerating] = useState(false); // State to indicate if PDF generation is in progress

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

    setIsPdfGenerating(true); // Set generating state to true

    toast({
      title: "Generating PDF...",
      description:
        "Please wait while your match statistics are being compiled.",
    });

    const doc = new jsPDF("p", "pt", "a4");
    const margin = 20;
    let yOffset = margin;

    const tabsToExport = ["overview", "scores", "sets", "players"];
    // const setsToExport = [null, ...sets.map((s) => s.id)]; // No longer needed as a direct loop variable

    try {
      for (const tab of tabsToExport) {
        setActiveTab(tab); // Activate the main tab
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for tab content to render

        const elementId = `${tab}-section`;
        const input = document.getElementById(elementId);

        if (input) {
          // 1. Capture "All Sets" view for the current tab
          doc.addPage();
          yOffset = margin;
          doc.setFontSize(20);
          doc.text(`${tab.charAt(0).toUpperCase() + tab.slice(1)} - All Sets Overview`, margin, yOffset);
          yOffset += 40;

          const canvasAllSets = await html2canvas(input, {
            scale: 2,
            useCORS: true,
          });
          const imgDataAllSets = canvasAllSets.toDataURL("image/png");
          const imgWidth = 595 - 2 * margin;
          const imgHeightAllSets = (canvasAllSets.height * imgWidth) / canvasAllSets.width;

          if (yOffset + imgHeightAllSets > doc.internal.pageSize.height - margin && yOffset !== margin + 40) {
            doc.addPage();
            yOffset = margin;
          }
          doc.addImage(imgDataAllSets, "PNG", margin, yOffset, imgWidth, imgHeightAllSets);
          yOffset += imgHeightAllSets + margin;

          // 2. Iterate and capture for each individual set for the current tab
          for (const set of sets) { // Iterate through actual sets
            //TODO Select individual set
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for data filtering and re-render

            doc.addPage();
            yOffset = margin;
            doc.setFontSize(20);
            doc.text(`${tab.charAt(0).toUpperCase() + tab.slice(1)} - Set ${set.set_number} Breakdown`, margin, yOffset);
            yOffset += 40;

            const canvasIndividualSet = await html2canvas(input, {
              scale: 2,
              useCORS: true,
            });
            const imgDataIndividualSet = canvasIndividualSet.toDataURL("image/png");
            const imgHeightIndividualSet = (canvasIndividualSet.height * imgWidth) / canvasIndividualSet.width;

            if (yOffset + imgHeightIndividualSet > doc.internal.pageSize.height - margin && yOffset !== margin + 40) {
              doc.addPage();
              yOffset = margin;
            }
            doc.addImage(imgDataIndividualSet, "PNG", margin, yOffset, imgWidth, imgHeightIndividualSet);
            yOffset += imgHeightIndividualSet + margin;
          }

          // Add a new page for the next main tab
          if (tab !== tabsToExport[tabsToExport.length - 1]) {
            doc.addPage();
            yOffset = margin;
          }
        } else {
          console.warn(`Element with ID ${elementId} not found for PDF export.`);
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
      setIsPdfGenerating(false); // Reset generating state
      setActiveTab("overview"); // Reset active tab after export
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

            <TabsContent
              value="overview"
              id="overview-section"
              className="space-y-4"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Final Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full">
                      <MatchScoreDetails
                        match={match}
                        sets={sets}
                        homeTeam={
                          match.home_team_id === managedTeam?.id
                            ? managedTeam!
                            : opponentTeam!
                        }
                        awayTeam={
                          match.away_team_id === managedTeam?.id
                            ? managedTeam!
                            : opponentTeam!
                        }
                        isPdfGenerating={isPdfGenerating}
                      />
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
              <MVPAnalysis sets={sets} stats={stats} players={players} />
            </TabsContent>

            <TabsContent value="sets" id="sets-section">
              <SetBreakdown
                match={match}
                sets={sets}
                points={points}
                managedTeam={managedTeam!}
                opponentTeam={opponentTeam!}
                isPdfGenerating={isPdfGenerating}
              />
            </TabsContent>

            <TabsContent value="players" id="players-section">
              <PlayerPerformance
                match={match}
                managedTeam={managedTeam!}
                opponentTeam={opponentTeam!}
                players={players}
                stats={stats}
                sets={sets}
              />
            </TabsContent>

            <TabsContent value="scores" id="scores-section">
              <ScoreProgression
                match={match}
                points={points}
                sets={sets}
                isPdfGenerating={isPdfGenerating}
              />
            </TabsContent>

            <TabsContent value="team">
              <TeamPerformance
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
