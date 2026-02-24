"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
import { jsPDF } from "jspdf";
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
import { useOnlineStatus } from "@/hooks/use-online-status";
import { supabase } from "@/lib/supabase/client";
import { MatchOverview } from "@/components/matches/stats/match-overview";
import { PdfExportHandle } from "@/lib/pdf/types";
import {
  PdfLoadingOverlay,
  PdfGenerationStep,
} from "@/components/ui/pdf-loading-overlay";

export default function MatchStatsPage() {
  const t = useTranslations("matches");
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
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfSteps, setPdfSteps] = useState<PdfGenerationStep[]>([
    { id: "overview", label: t("stats.tabs.overview"), status: "pending" },
    { id: "scores", label: t("stats.tabs.scores"), status: "pending" },
    { id: "sets", label: t("stats.tabs.sets"), status: "pending" },
    { id: "players", label: t("stats.tabs.players"), status: "pending" },
    { id: "team", label: t("stats.tabs.team"), status: "pending" },
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

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
          throw new Error(t("errors.selectTeam"));
        }

        const teamId = searchParams.get("team");

        if (
          teamId !== matchData.home_team_id &&
          teamId !== matchData.away_team_id
        ) {
          throw new Error(t("errors.managedTeamNotFound"));
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
          title: t("toast.error"),
          description: t("toast.loadError"),
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
          throw new Error(t("live.matchNotFound"));
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
          throw new Error(t("errors.selectTeam"));
        }

        const teamId = searchParams.get("team");

        if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
          throw new Error(t("errors.managedTeamNotFound"));
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
          throw new Error(t("errors.teamsNotFound"));
        }

        const teams = Array.from(teamDocs.values()).map((doc) => doc.toJSON());

        setManagedTeam(teams.find((team) => team.id === teamId));
        setOpponentTeam(teams.find((team) => team.id !== teamId));
      } catch (error) {
        console.error("Failed to load local match data:", error);
        toast({
          variant: "destructive",
          title: t("toast.error"),
          description: t("toast.failedLoadLocalMatchData"),
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
  }, [db, matchId, isOnline, t]);

  const updateStepStatus = (
    stepId: string,
    status: PdfGenerationStep["status"]
  ) => {
    setPdfSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status } : step))
    );
  };

  const resetSteps = () => {
    setPdfSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" }))
    );
    setCurrentStepIndex(0);
  };

  const cancelPdfGeneration = () => {
    abortControllerRef.current?.abort();
    setIsPdfGenerating(false);
    resetSteps();
    document.body.removeAttribute("data-pdf-export");
    toast({
      title: t("stats.pdfGenerationCancelled"),
      description: t("pdf.cancelled"),
    });
  };

  const exportToPDF = async () => {
    if (!match || isPdfGenerating) return;

    setIsPdfGenerating(true);
    resetSteps();
    abortControllerRef.current = new AbortController();

    // Enable PDF export mode for proper badge styling
    document.body.setAttribute("data-pdf-export", "true");

    const doc = new jsPDF("p", "pt", "a4");
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();

    let docTitle = t("stats.matchStats");
    if (managedTeam && opponentTeam) {
      docTitle += ` - ${managedTeam.name} vs ${opponentTeam.name}`;
    }
    // --- Title Page ---
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(docTitle, pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(12);
    doc.text(new Date(match.date).toLocaleDateString(), pageWidth / 2, 110, {
      align: "center",
    });

    const componentsToExport = [
      { ref: overviewRef, title: t("pdf.steps.overview"), tab: "overview", stepId: "overview" },
      { ref: scoreProgressionRef, title: t("pdf.steps.scores"), tab: "scores", stepId: "scores" },
      { ref: setBreakdownRef, title: t("pdf.steps.sets"), tab: "sets", stepId: "sets" },
      { ref: playerPerformanceRef, title: t("pdf.steps.players"), tab: "players", stepId: "players" },
      // { ref: teamPerformanceRef, title: "Team Performance", tab: "team", stepId: "team" },
    ];

    const initialTab = activeTab;
    let isFirstComponent = true;

    try {
      for (let i = 0; i < componentsToExport.length; i++) {
        // Check for cancellation
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error(t("stats.errors.pdfCancelled"));
        }

        const { ref, title, tab, stepId } = componentsToExport[i];

        // Update progress
        setCurrentStepIndex(i);
        updateStepStatus(stepId, "in-progress");

        setActiveTab(tab);
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Add page before each component except the first
        if (!isFirstComponent) {
          doc.addPage();
        }
        isFirstComponent = false;

        if (ref.current) {
          await ref.current.generatePdfContent(doc, margin, sets, title);
        } else {
          console.warn(
            `Ref for ${title} not found. Skipping PDF generation for this component.`
          );
        }

        updateStepStatus(stepId, "completed");
      }

      doc.save(`match-stats-${matchId}.pdf`);
      toast({
        title: t("pdf.success"),
        description: t("pdf.successDesc"),
      });
    } catch (error) {
      if ((error as Error).message === "Cancelled") {
        // Already handled by cancelPdfGeneration
        return;
      }
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: t("pdf.failed"),
        description: t("pdf.failedDesc"),
      });
    } finally {
      document.body.removeAttribute("data-pdf-export");
      setIsPdfGenerating(false);
      setActiveTab(initialTab);
      abortControllerRef.current = null;
    }
  };

  const shareStats = async () => {
    try {
      await navigator.share({
        title: t("stats.title"),
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
    return <div>{t("live.matchNotFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <PdfLoadingOverlay
        isVisible={isPdfGenerating}
        steps={pdfSteps}
        currentStepIndex={currentStepIndex}
        onCancel={cancelPdfGeneration}
      />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("stats.title")}</h1>
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
            {isPdfGenerating ? t("stats.tabs.pending") : "Export PDF"}
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
              <TabsTrigger value="overview">{t("stats.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="scores">{t("stats.tabs.scores")}</TabsTrigger>
              <TabsTrigger value="sets">{t("stats.tabs.sets")}</TabsTrigger>
              <TabsTrigger value="players">{t("stats.tabs.players")}</TabsTrigger>
              <TabsTrigger value="team">{t("stats.tabs.team")}</TabsTrigger>
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
