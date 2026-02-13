"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LiveMatchSidebar } from "@/components/matches/live/live-match-sidebar";
import { PlayerPerformancePanel } from "@/components/matches/live/panels/player-performance-panel";
import { EventsPanel } from "@/components/matches/live/panels/events-panel";
import { CourtDiagramPanel } from "@/components/matches/live/panels/court-diagram-panel";
import { ScorePointsPanel } from "@/components/matches/live/panels/score-points-panel";
import type {
  Match,
  TeamMember,
  PlayerStat,
  ScorePoint,
  Set,
  Substitution,
  Team,
  MatchFormat,
  Event,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { SetSetup } from "@/components/sets/set-setup";
import { useCommandHistory } from "@/hooks/use-command-history";
import { MatchState } from "@/lib/commands/command";
import {
  PlayerStatCommand,
  ScorePointCommand,
  SetSetupCommand,
  SubstitutionCommand,
} from "@/lib/commands/match-commands";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { MVPAnalysis } from "@/components/matches/stats/mvp-analysis";
import { cn } from "@/lib/utils";
import { BarChart3, WifiOff } from "lucide-react";
import { MatchScoreDetails } from "@/components/matches/match-score-details";
import { useLandscape } from "@/hooks/use-landscape";
import { set } from "lodash";

type PanelType = "stats" | "events" | "court" | "points" | null;

const initialMatchState: MatchState = {
  match: null,
  currentSet: null,
  setPoints: [],
  points: [],
  sets: [],
  setStats: [],
  stats: [],
  setEvents: [],
  events: [],
  score: { home: 0, away: 0 },
};

export default function LiveMatchPage() {
  const t = useTranslations("matches");
  const { id: matchId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { isOnline, wasOffline } = useOnlineStatus();
  const { localDb: db } = useLocalDb();
  const router = useRouter();
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState);
  const [teamPlayers, setTeamPlayers] = useState<TeamMember[]>([]);
  const [teamPlayerById, setTeamPlayerById] = useState<Map<string, TeamMember>>(
    new Map()
  );
  const [homeTeam, setHomeTeam] = useState<Team>();
  const [awayTeam, setAwayTeam] = useState<Team>();
  const [managedTeam, setManagedTeam] = useState<Team>();
  const [opponentTeam, setOpponentTeam] = useState<Team>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const { history, canUndo, canRedo } = useCommandHistory();

  const LOADING_STEPS = [
    { label: t("live.syncingMatchData"), description: t("live.ensuringLatestData") },
    { label: t("live.loadingMatchFormat"), description: t("live.gettingMatchRules") },
    { label: t("live.loadingTeams"), description: t("live.fetchingTeamInfo") },
  ];

  // Sidebar and panel state
  const [showDesktopPanel, setShowDesktopPanel] = useState(false); // Desktop grid panel
  const [showMobileDrawer, setShowMobileDrawer] = useState(false); // Mobile Sheet drawer
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const isLandscape = useLandscape();

  // Memoized data loading function
  const loadMatchData = useCallback(async () => {
    if (!db) return;

    try {
      setIsLoading(true);
      const teamId = searchParams.get("team");
      if (!teamId) {
        throw new Error(t("errors.selectTeam"));
      }

      setLoadingStep(0);
      try {
        const synced = await db?.syncManager.syncMatch(matchId);
        if (synced) {
          toast({
            title: t("live.readyForOffline"),
            description: t("live.readyForOfflineDesc"),
          });
        } else {
          toast({
            variant: "default",
            title: t("live.syncTimeout"),
            description: t("live.syncTimeoutDesc"),
          });
        }
      } catch (e) {
        console.error("Sync failed", e);
        toast({
          variant: "destructive",
          title: t("live.syncWarning"),
          description: t("live.syncWarningDesc"),
        });
      }

      setLoadingStep(1);
      const [matchDoc, setDocs] = await Promise.all([
        db.matches.findOne(matchId).exec(),
        db.sets
          .find({
            selector: {
              match_id: matchId,
            },
            sort: [{ set_number: "asc" }],
          })
          .exec(),
      ]);

      if (!matchDoc) {
        throw new Error(t("live.matchNotFound"));
      }

      const match = matchDoc.toMutableJSON() as Match;
      const formatDoc = await db.match_formats
        .findOne(match.match_format_id)
        .exec();
      if (!formatDoc) {
        throw new Error(t("live.loadingMatchFormat"));
      }
      const format = formatDoc.toMutableJSON();
      match.match_formats = format as MatchFormat;

      const teamDocs = await db.teams
        .findByIds([match.home_team_id, match.away_team_id])
        .exec();

      if (!teamDocs || teamDocs.size !== 2) {
        throw new Error(t("errors.teamsNotFound"));
      }

      const teams = Array.from(teamDocs.values()).map((doc) => doc.toJSON());
      if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
        throw new Error(t("errors.managedTeamNotFound"));
      }
      setHomeTeam(teams[0]);
      setAwayTeam(teams[1]);
      setManagedTeam(teams.find((team) => team.id === teamId));
      setOpponentTeam(teams.find((team) => team.id !== teamId));

      setLoadingStep(2);
      const playerIds =
        teamId === match.home_team_id
          ? match.home_available_players
          : match.away_available_players;
      const availablePlayerDocs = await db.team_members
        .findByIds(playerIds as string[])
        .exec();
      if (availablePlayerDocs) {
        const teamPlayers = Array.from(availablePlayerDocs.values()).map(
          (doc) => doc.toJSON()
        );
        setTeamPlayers(teamPlayers);
        const playerById: Map<string, TeamMember> = new Map();
        teamPlayers.forEach((player) => {
          playerById.set(player.id, player);
        });
        setTeamPlayerById(playerById);
      } else {
        console.warn("No available players found for team:", teamId);
      }

      const sets = setDocs.map((doc) => doc.toMutableJSON());
      const currentSet = sets[sets.length - 1];
      let [points, stats, events] = await Promise.all([
          db.score_points
            .find({
              selector: {
                match_id: matchId
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
          db.player_stats
            .find({
              selector: {
                match_id: matchId
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
            db.events
            .find({
              selector: {
                match_id: matchId
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
        ]);
      let setPoints: ScorePoint[] = [];
      let setStats: PlayerStat[] = [];
      let setEvents: Event[] = [];
      if(currentSet) {
        setPoints = points.filter((point) => point.set_id === currentSet.id);
        setStats = stats.filter((stat) => stat.set_id === currentSet.id);
        setEvents = events.filter((event) => event.set_id === currentSet.id);

        // Recalculate current set score from points (in case of late sync)
        let setScore = setPoints.reduce((acc, point) => {
          if(point.home_score > acc.home) {
            acc.home = point.home_score;
          }
          if(point.away_score > acc.away) {
            acc.away = point.away_score;
          }
          return acc;
        }, { home: 0, away: 0 });
        if(setScore.home > currentSet.home_score || setScore.away > currentSet.away_score) {
          console.debug("Recalculating current set score from points:", setScore);
          currentSet.home_score = setScore.home;
          currentSet.away_score = setScore.away;
        }
      }

      setMatchState({
        match,
        currentSet: currentSet || null,
        setPoints,
        points,
        sets,
        setStats,
        stats,
        events,
        setEvents,
        score: currentSet
          ? { home: currentSet.home_score, away: currentSet.away_score }
          : { home: 0, away: 0 },
      });
    } catch (error) {
      console.error("Failed to load match data:", error);
      toast({
        variant: "destructive",
        title: t("live.failedLoadMatchData"),
        description:
          error instanceof Error ? error.message : t("live.failedLoadMatchData"),
      });
      router.push("/matches");
    } finally {
      setIsLoading(false);
    }
  }, [db, matchId, router, t]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  const onSetSetupComplete = useCallback(
    async (newSet: Set) => {
      if (!db) return;
      const command = new SetSetupCommand(matchState, newSet, db);

      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
      } catch (error) {
        console.error("Failed to complete set setup:", error);
        toast({
          variant: "destructive",
          title: t("live.failedCompleteSetSetup"),
          description: t("live.failedCompleteSetSetup"),
        });
      }
    },
    [db, matchState, history, t]
  );

  const onSubstitutionRecorded = useCallback(
    async (substitution: Substitution) => {
      if (!db) return;
      const command = new SubstitutionCommand(matchState, substitution, db);

      try {
        const newMatchState = await history.executeCommand(command);

        setMatchState(newMatchState);

        const playerOut = teamPlayerById.get(substitution.player_out_id);
        const playerIn = teamPlayerById.get(substitution.player_in_id);

        toast({
          title: t("live.substitution"),
          description:
            playerOut && playerIn
              ? `#${playerOut.number} ${playerOut.name} replaced by #${playerIn.number} ${playerIn.name} at position ${substitution.position}`
              : t("matches.toast.substitutionRecordedDesc"),
        });
      } catch (error) {
        console.error("Failed to record substitution:", error);
        toast({
          variant: "destructive",
          title: t("live.failedRecordSubstitution"),
          description: t("live.failedRecordSubstitution"),
        });
      }
    },
    [db, matchState, history, teamPlayerById, t]
  );

  const onPlayerStatRecorded = useCallback(
    async (stat: PlayerStat) => {
      if (!db) return;

      const command = new PlayerStatCommand(matchState, stat, db);
      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
        if (newMatchState.match!.status === "completed") {
          onMatchCompleted();
        }
      } catch (error) {
        console.error("Failed to record stat:", error);
        toast({
          variant: "destructive",
          title: t("live.failedRecordStat"),
          description: t("live.failedRecordStat"),
        });
      }
    },
    [db, matchState, history, t]
  );

  const onPointRecorded = useCallback(
    async (point: ScorePoint) => {
      if (!db) return;
      if (!matchState.currentSet || !matchState.match) return;

      const myTeam = managedTeam!.id === point.scoring_team_id;
      const command = new ScorePointCommand(matchState, point, myTeam, db);
      try {
        const newMatchState = await history.executeCommand(command);
        setMatchState(newMatchState);
        if (newMatchState.match!.status === "completed") {
          onMatchCompleted();
        }
      } catch (error) {
        console.error("Failed to record point:", error);
        toast({
          variant: "destructive",
          title: t("live.failedRecordPoint"),
          description: t("live.failedRecordPoint"),
        });
      }
    },
    [db, matchState, managedTeam, history, t]
  );

  const onMatchCompleted = () => {
    if (isOnline) {
      toast({
        title: t("live.matchFinished"),
        description: t("live.matchFinished"),
      });
      // const searchParams = new URLSearchParams();
      // searchParams.set("team", managedTeam!.id);
      // router.push(
      //   `/matches/${matchState.match!.id}/stats?${searchParams.toString()}`
      // );
    } else {
      toast({
        title: t("live.matchFinished"),
        description: t("live.mustBeOnlineToViewStats"),
      });
    }
  };

  const handleUndo = async () => {
    try {
      const state = await history.undo();
      setMatchState(state);

      toast({
        title: t("live.actionUndone"),
        description: t("live.lastActionUndone"),
      });
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        variant: "destructive",
        title: t("live.failedUndoAction"),
        description: t("live.failedUndoAction"),
      });
    }
  };

  if (isLoading) {
    const currentStep = LOADING_STEPS[loadingStep];
    const progress = ((loadingStep + 1) / LOADING_STEPS.length) * 100;

    return (
      <div className="h-[600px] w-full flex items-center justify-center">
        <Card className="p-6 w-full max-w-md">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
              <h3 className="font-semibold text-lg">{currentStep.label}</h3>
              <p className="text-sm text-muted-foreground">{currentStep.description}</p>
            </div>

            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Step {loadingStep + 1} of {LOADING_STEPS.length}
              </p>
            </div>

            <div className="flex justify-center gap-1.5">
              {LOADING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors duration-200",
                    index <= loadingStep ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!matchState.match || !homeTeam || !awayTeam) {
    return <div>{t("live.matchNotFound")}</div>;
  }

  if (matchState.match.status === "completed") {
    return (
      <div className="space-y-1">
        <div className="w-full ml-auto">
          <MatchScoreDetails
            match={matchState.match}
            sets={matchState.sets}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />
        </div>

        <MVPAnalysis
          sets={matchState.sets}
          stats={matchState.stats}
          players={teamPlayers}
        />

        <div className="flex justify-center pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("team", managedTeam!.id);
                      router.push(
                        `/matches/${matchState.match!.id}/stats?${params.toString()}`
                      );
                    }}
                    disabled={!isOnline}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {t("stats.title")}
                  </Button>
                </span>
              </TooltipTrigger>
              {!isOnline && (
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4" />
                    <span>{t("live.needInternetForStats")}</span>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  // Helper to render the panel content
  const renderPanelContent = () => {
    if (!matchState.match) return null;

    if (activePanel === "stats") {
      return (
        <PlayerPerformancePanel
          managedTeam={managedTeam!}
          stats={matchState.setStats}
          currentSet={matchState.currentSet}
          playerById={teamPlayerById}
        />
      );
    }
    if (activePanel === "events") {
      return (
        <EventsPanel
          matchId={matchId}
          setId={matchState.currentSet?.id || null}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          players={teamPlayers}
          playerById={teamPlayerById}
          managedTeamId={managedTeam!.id}
          currentSet={matchState.currentSet}
          currentHomeScore={matchState.currentSet?.home_score ?? 0}
          currentAwayScore={matchState.currentSet?.away_score ?? 0}
          currentPointNumber={
            matchState.setPoints.length > 0 ? matchState.setPoints.length : undefined
          }
          currentLineup={matchState.currentSet?.current_lineup}
          onSubstitutionRecorded={onSubstitutionRecorded}
        />
      );
    }
    if (activePanel === "points") {
      return (
        <ScorePointsPanel
          scorePoints={matchState.setPoints}
          playerStats={matchState.setStats}
          playerById={teamPlayerById}
          currentSet={matchState.currentSet}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          managedTeamId={managedTeam!.id}
        />
      );
    }
    if (activePanel === "court" && matchState.match.match_formats) {
      return (
        <CourtDiagramPanel
          players={teamPlayers}
          currentSet={matchState.currentSet}
          matchFormat={matchState.match.match_formats}
          team={managedTeam!}
        />
      );
    }
    return null;
  };

  // Helper to render main content
  const renderMainContent = () => {
    if (!matchState.match) return null;

    if (!matchState.currentSet || matchState.currentSet.status === "completed") {
      return (
        <Card className="p-1 h-full">
          <SetSetup
            match={matchState.match}
            sets={matchState.sets}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            setNumber={matchState.currentSet ? matchState.currentSet.set_number + 1 : 1}
            players={teamPlayers}
            playerById={teamPlayerById}
            onComplete={onSetSetupComplete}
          />
        </Card>
      );
    }

    return (
      <Card className="p-1 h-full">
        <StatTracker
          onStat={onPlayerStatRecorded}
          onPoint={onPointRecorded}
          onUndo={handleUndo}
          playerById={teamPlayerById}
          opponentTeam={opponentTeam!}
          managedTeam={managedTeam!}
          match={matchState.match}
          currentSet={matchState.currentSet}
          sets={matchState.sets}
          stats={matchState.setStats}
          points={matchState.setPoints}
          score={matchState.score}
        />
      </Card>
    );
  };

  // Calculate grid columns for desktop/tablet
  const gridTemplateColumns = showDesktopPanel
    ? [
        navExpanded ? "200px" : "48px", // Nav
        "1fr", // Panel (1/3)
        "2fr", // Main content (2/3)
      ].join(" ")
    : [
        navExpanded ? "200px" : "48px", // Nav
        "1fr", // Main content (full width)
      ].join(" ");

  return (
    <div className="h-full flex flex-col">
      {/* Row 1: Header - Full Width */}
      <div className="w-full shrink-0">
        <MatchScoreDetails
          match={matchState.match}
          sets={matchState.sets}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      </div>

      {/* Row 2: Content - Responsive Layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop/Tablet: Grid Layout - Hidden in landscape mobile mode */}
        <div
          className={cn(
            "h-full gap-2 p-1 transition-all duration-300 ease-in-out",
            isLandscape ? "hidden" : "hidden md:grid"
          )}
          style={{ gridTemplateColumns }}
        >
          {/* Column 1: Nav - No scroll */}
          <nav className="h-full overflow-hidden">
            <LiveMatchSidebar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              showPanel={showDesktopPanel}
              onTogglePanel={() => setShowDesktopPanel(!showDesktopPanel)}
              navExpanded={navExpanded}
              onToggleNav={() => setNavExpanded(!navExpanded)}
            />
          </nav>

          {/* Column 2: Panel (conditional) - Internal scrolling */}
          {showDesktopPanel && (
            <aside className="h-full overflow-hidden border-l">
              <div className="h-full overflow-y-auto live-match-scroll">
                {renderPanelContent()}
              </div>
            </aside>
          )}

          {/* Column 3: Main Content - Independent scrolling */}
          <main className="h-full overflow-hidden">
            <div className="h-full overflow-y-auto live-match-scroll">
              {renderMainContent()}
            </div>
          </main>
        </div>

        {/* Mobile: Flex Layout + Drawer - Also show in landscape mode */}
        <div className={cn(
          "flex flex-col h-full",
          isLandscape ? "flex" : "md:hidden"
        )}>
          {/* Mobile Nav: Show horizontal icons, or vertical sidebar in landscape */}
          {isLandscape ? (
            <div className="flex h-full">
              {/* Landscape: Vertical sidebar on left */}
              <nav className="shrink-0 border-r h-full">
                <LiveMatchSidebar
                  activePanel={activePanel}
                  onPanelChange={setActivePanel}
                  showPanel={showMobileDrawer}
                  onTogglePanel={() => setShowMobileDrawer(!showMobileDrawer)}
                  isMobile={false}
                  isLandscape={true}
                />
              </nav>

              {/* Landscape: Main Content */}
              <main className="flex-1 overflow-hidden p-1">
                <div className="h-full overflow-y-auto live-match-scroll">
                  {renderMainContent()}
                </div>
              </main>

              {/* Landscape: Panel Drawer */}
              <Sheet open={showMobileDrawer} onOpenChange={setShowMobileDrawer}>
                <SheetContent
                  side="right"
                  className="w-[70%] overflow-hidden flex flex-col"
                  title={t("live.matchPanel")}
                >
                  <div className="flex-1 overflow-y-auto live-match-scroll">
                    {renderPanelContent()}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
            <>
              {/* Portrait: Horizontal nav */}
              <nav className="shrink-0 border-b">
                <LiveMatchSidebar
                  activePanel={activePanel}
                  onPanelChange={setActivePanel}
                  showPanel={showMobileDrawer}
                  onTogglePanel={() => setShowMobileDrawer(!showMobileDrawer)}
                  isMobile={true}
                />
              </nav>

              {/* Portrait: Main Content */}
              <main className="flex-1 overflow-hidden p-2">
                <div className="h-full overflow-y-auto live-match-scroll">
                  {renderMainContent()}
                </div>
              </main>

              {/* Portrait: Panel Drawer */}
              <Sheet open={showMobileDrawer} onOpenChange={setShowMobileDrawer}>
                <SheetContent
                  side="right"
                  className="w-[85%] overflow-hidden flex flex-col"
                  title={t("live.matchPanel")}
                >
                  <div className="flex-1 overflow-y-auto live-match-scroll">
                    {renderPanelContent()}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
