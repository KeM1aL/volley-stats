"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { LiveMatchHeader } from "@/components/matches/live/live-match-header";
import { ScoreBoard } from "@/components/matches/live/score-board";
import { StatTracker } from "@/components/matches/live/stat-tracker";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { MatchScoreDetails } from "@/components/matches/match-score-details";

type PanelType = "stats" | "events" | "court" | "points" | null;

const initialMatchState: MatchState = {
  match: null,
  set: null,
  points: [],
  sets: [],
  stats: [],
  score: { home: 0, away: 0 },
};

export default function LiveMatchPage() {
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
  const { history, canUndo, canRedo } = useCommandHistory();

  // Sidebar and panel state
  const [showDesktopPanel, setShowDesktopPanel] = useState(false); // Desktop grid panel
  const [showMobileDrawer, setShowMobileDrawer] = useState(false); // Mobile Sheet drawer
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const playerById: Map<string, TeamMember> = new Map();
      teamPlayers.forEach((player) => {
        playerById.set(player.id, player);
      });
      setTeamPlayerById(playerById);
    };

    loadData();
  }, [teamPlayers]);

  // Memoized data loading function
  const loadMatchData = useCallback(async () => {
    if (!db) return;

    try {
      setIsLoading(true);

      const [matchDoc, setDocs] = await Promise.all([
        db.matches.findOne(matchId).exec(),
        db.sets
          .find({
            selector: {
              match_id: matchId,
            },
            sort: [{ created_at: "asc" }],
          })
          .exec(),
      ]);

      if (!matchDoc) {
        throw new Error("Match not found");
      }

      const match = matchDoc.toMutableJSON() as Match;
      const formatDoc = await db.match_formats
        .findOne(match.match_format_id)
        .exec();
      if (!formatDoc) {
        throw new Error("Match format not found");
      }
      const format = formatDoc.toMutableJSON();
      match.match_formats = format as MatchFormat;

      const teamDocs = await db.teams
        .findByIds([match.home_team_id, match.away_team_id])
        .exec();

      if (!teamDocs || teamDocs.size !== 2) {
        throw new Error("Teams not found");
      }

      const teams = Array.from(teamDocs.values()).map((doc) => doc.toJSON());

      const managedTeamParam = searchParams.get("team");
      if (!managedTeamParam) {
        throw new Error("Please select your managed team");
      }

      const teamId = searchParams.get("team");
      if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
        throw new Error("Managed Team not found");
      }
      setHomeTeam(teams[0]);
      setAwayTeam(teams[1]);
      setManagedTeam(teams.find((team) => team.id === teamId));
      setOpponentTeam(teams.find((team) => team.id !== teamId));

      const playerIds =
        teamId === match.home_team_id
          ? match.home_available_players
          : match.away_available_players;
      const availablePlayerDocs = await db.team_members
        .findByIds(playerIds as string[])
        .exec();
      if (availablePlayerDocs) {
        setTeamPlayers(
          Array.from(availablePlayerDocs.values()).map((doc) => doc.toJSON())
        );
      }

      const sets = setDocs.map((doc) => doc.toJSON());
      const currentSet = sets[sets.length - 1];

      let points: ScorePoint[] = [];
      let stats: PlayerStat[] = [];

      if (currentSet) {
        [points, stats] = await Promise.all([
          db.score_points
            .find({
              selector: {
                match_id: matchId,
                set_id: currentSet.id,
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
          db.player_stats
            .find({
              selector: {
                match_id: matchId,
                set_id: currentSet.id,
              },
              sort: [{ created_at: "asc" }],
            })
            .exec()
            .then((docs) => docs.map((doc) => doc.toJSON())),
        ]);
      }

      setMatchState({
        match,
        set: currentSet || null,
        points,
        sets,
        stats,
        score: currentSet
          ? { home: currentSet.home_score, away: currentSet.away_score }
          : { home: 0, away: 0 },
      });
    } catch (error) {
      console.error("Failed to load match data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load match data",
      });
      router.push("/matches");
    } finally {
      setIsLoading(false);
    }
  }, [db, matchId, router]);

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
          title: "Error",
          description: "Failed to complete set setup",
        });
      }
    },
    [db, matchState]
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
          title: "Substitution recorded",
          description: playerOut && playerIn
            ? `#${playerOut.number} ${playerOut.name} replaced by #${playerIn.number} ${playerIn.name} at position ${substitution.position}`
            : "Substitution recorded successfully",
        });
      } catch (error) {
        console.error("Failed to record substitution:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record substitution",
        });
      }
    },
    [db, matchState, history, teamPlayerById]
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
          title: "Error",
          description: "Failed to record stat",
        });
      }
    },
    [db, matchState.score, matchState.set]
  );

  const onPointRecorded = useCallback(
    async (point: ScorePoint) => {
      if (!db) return;
      if (!matchState.set || !matchState.match) return;

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
          title: "Error",
          description: "Failed to record point",
        });
      }
    },
    [db, matchState, router]
  );

  const onMatchCompleted = () => {
    if (isOnline) {
      toast({
        title: "Match Finished",
        description: "Let's go to the stats !",
      });
      const searchParams = new URLSearchParams();
      searchParams.set("team", managedTeam!.id);
      router.push(
        `/matches/${matchState.match!.id}/stats?${searchParams.toString()}`
      );
    } else {
      toast({
        title: "Match Finished",
        description: "You must be online to view the stats",
      });
    }
  };

  const handleUndo = async () => {
    try {
      const state = await history.undo();
      setMatchState(state);

      toast({
        title: "Action undone",
        description: "The last action has been undone",
      });
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to undo action",
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (!matchState.match || !homeTeam || !awayTeam) {
    return <div>Match not found</div>;
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
          stats={matchState.stats}
          currentSet={matchState.set}
          playerById={teamPlayerById}
        />
      );
    }
    if (activePanel === "events") {
      return (
        <EventsPanel
          matchId={matchId}
          setId={matchState.set?.id || null}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          players={teamPlayers}
          playerById={teamPlayerById}
          managedTeamId={managedTeam!.id}
          currentHomeScore={matchState.set?.home_score ?? 0}
          currentAwayScore={matchState.set?.away_score ?? 0}
          currentPointNumber={matchState.points.length > 0 ? matchState.points.length : undefined}
          currentLineup={matchState.set?.current_lineup}
          onSubstitutionRecorded={onSubstitutionRecorded}
        />
      );
    }
    if (activePanel === "points") {
      return (
        <ScorePointsPanel
          scorePoints={matchState.points}
          playerStats={matchState.stats}
          playerById={teamPlayerById}
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
          currentSet={matchState.set}
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

    if (!matchState.set || matchState.set.status === "completed") {
      return (
        <Card className="p-1 h-full">
          <SetSetup
            match={matchState.match}
            sets={matchState.sets}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            setNumber={matchState.set ? matchState.set.set_number + 1 : 1}
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
          currentSet={matchState.set}
          sets={matchState.sets}
          stats={matchState.stats}
          points={matchState.points}
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
        {/* Desktop/Tablet: Grid Layout */}
        <div
          className="hidden md:grid h-full gap-2 p-1 transition-all duration-300 ease-in-out"
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
              {renderPanelContent()}
            </aside>
          )}

          {/* Column 3: Main Content - No page scroll */}
          <main className="h-full overflow-hidden">{renderMainContent()}</main>
        </div>

        {/* Mobile: Flex Layout + Drawer */}
        <div className="md:hidden flex flex-col h-full">
          {/* Mobile Nav: Horizontal Icons */}
          <nav className="shrink-0 border-b">
            <LiveMatchSidebar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              showPanel={showMobileDrawer}
              onTogglePanel={() => setShowMobileDrawer(!showMobileDrawer)}
              isMobile={true}
            />
          </nav>

          {/* Mobile Main Content */}
          <main className="flex-1 overflow-hidden p-2">
            {renderMainContent()}
          </main>

          {/* Mobile Panel: Drawer */}
          <Sheet open={showMobileDrawer} onOpenChange={setShowMobileDrawer}>
            <SheetContent side="right" className="w-[85%] overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden">
                {renderPanelContent()}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
