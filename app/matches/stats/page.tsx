"use client";

import { Suspense, useEffect, useState } from "react";
import { notFound, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share2 } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { canExportForTeam } from "@/lib/report/can-export";
import { apiFetch } from "@/lib/api-client";
import { platform } from "@/lib/platform";
import { fileNameFromDisposition } from "@/lib/report/download";
import { useRouteId } from "@/hooks/use-route-id";
import { routes } from "@/lib/routes";
import { LoadingPage } from "@/components/loading-page";

class ReportRequestError extends Error {
  constructor(readonly status: number) {
    super(`Report request failed with ${status}`);
  }
}

function MatchStatsPage({ matchId }: { matchId: string }) {
  const t = useTranslations("matches");
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
  const [isExporting, setIsExporting] = useState(false);
  const locale = useLocale();
  const { user } = useAuth();
  const syncStatus = useSyncStatus();

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

        const [
          { data: setsData, error: setsError },
          { data: playerStatsData, error: playerStatsError },
          { data: scorePointsData, error: scorePointsError },
          // @ts-ignore
          { data: availablePlayersData, error: availablePlayersError },
          { data: teamsData, error: teamsError },
        ] = await Promise.all([
          supabase
            .from("sets")
            .select("*")
            .eq("match_id", matchId as string)
            .eq("_deleted", false)
            .order("set_number", { ascending: true }),
          supabase
            .from("player_stats")
            .select("*")
            .eq("match_id", matchId as string)
            .eq("_deleted", false)
            .order("created_at", { ascending: true }),
          supabase
            .from("score_points")
            .select("*")
            .eq("match_id", matchId as string)
            .eq("_deleted", false)
            .order("created_at", { ascending: true }),
          supabase
            .from("team_members")
            .select("*")
            .in("id", playerIds as string[]),
          supabase
            .from("teams")
            .select("*")
            .in("id", [matchData.home_team_id, matchData.away_team_id]),
        ]);

        if (setsError) throw setsError;
        setSets(setsData);

        if (playerStatsError) throw playerStatsError;
        setStats(playerStatsData);

        if (scorePointsError) throw scorePointsError;
        setPoints(scorePointsData);

        if (availablePlayersError) throw availablePlayersError;
        setPlayers(availablePlayersData);

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

  const exportReport = async () => {
    if (!managedTeam || isExporting) return;
    setIsExporting(true);
    try {
      const response = await apiFetch(`/api/v1/matches/${matchId}/report?team=${encodeURIComponent(managedTeam.id)}&locale=${locale}`);
      if (!response.ok) throw new ReportRequestError(response.status);
      const fileName = fileNameFromDisposition(response.headers.get("content-disposition")) ?? `match-report-${matchId}.pdf`;
      await platform.saveFile(await response.blob(), fileName);
      toast({ title: t("pdf.success"), description: t("pdf.successDesc") });
    } catch (error) {
      console.error("Error exporting the match report:", error);
      const status = error instanceof ReportRequestError ? error.status : null;
      toast({
        variant: "destructive",
        title: t("pdf.failed"),
        description: status === 401 ? t("pdf.sessionExpired") : status === 403 ? t("pdf.forbidden") : t("pdf.failedDesc"),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareStats = async () => {
    try {
      await navigator.share({
        title: t("stats.title"),
        text: "Check out the statistics from our latest match!",
        url: platform.webOrigin() + routes.matchStats(matchId, Object.fromEntries(searchParams)),
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

  const canExport = canExportForTeam(user, managedTeam);
  const matchSync = syncStatus?.matches.find((summary) => summary.matchId === matchId);
  const hasUnsent = !!matchSync && matchSync.pending + matchSync.rejected > 0;
  const exportBlockedReason = !isOnline
    ? t("pdf.unavailableOffline")
    : hasUnsent
      ? t("pdf.unavailableUnsent")
      : points.length === 0
        ? t("pdf.unavailableNoRallies")
        : null;

  return (
    <div className="space-y-6">
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

          {canExport && (
            <span title={exportBlockedReason ?? undefined}>
              <Button variant="outline" onClick={exportReport} disabled={isExporting || exportBlockedReason !== null}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? t("pdf.exporting") : t("pdf.export")}
              </Button>
            </span>
          )}
          <Button variant="outline" onClick={shareStats}>
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
                  match={match}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                  points={points}
                  stats={stats}
                  sets={sets}
                  players={players}
                />
              )}
            </TabsContent>

            <TabsContent value="sets" id="sets-section">
              {match && managedTeam && opponentTeam && (
                <SetBreakdown
                  match={match}
                  sets={sets}
                  points={points}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                />
              )}
            </TabsContent>

            <TabsContent value="players" id="players-section">
              {match && managedTeam && opponentTeam && (
                <PlayerPerformance
                  match={match}
                  managedTeam={managedTeam}
                  opponentTeam={opponentTeam}
                  players={players}
                  stats={stats}
                  sets={sets}
                />
              )}
            </TabsContent>

            <TabsContent value="scores" id="scores-section">
              {match && (
                <ScoreProgression
                  match={match}
                  points={points}
                  sets={sets}
                />
              )}
            </TabsContent>

            <TabsContent value="team">
              <TeamPerformance
                match={match}
                managedTeam={managedTeam!}
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

function MatchStatsPageRoute() {
  const matchId = useRouteId();
  if (!matchId) notFound();
  return <MatchStatsPage matchId={matchId} />;
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <MatchStatsPageRoute />
    </Suspense>
  );
}
