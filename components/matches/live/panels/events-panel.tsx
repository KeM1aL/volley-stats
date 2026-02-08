"use client";

import { useTranslations } from "next-intl";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Event, TeamMember, Team, Set } from "@/lib/types";
import {
  EventType,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  isSubstitutionEvent,
  isTimeoutEvent,
  isInjuryEvent,
  isSanctionEvent,
  isTechnicalEvent,
  isCommentEvent,
  SubstitutionDetails,
  TimeoutDetails,
  InjuryDetails,
  SanctionDetails,
  TechnicalDetails,
  CommentDetails,
} from "@/lib/types/events";
import { EventForm } from "../events/event-form";
import {
  Plus,
  Users,
  Clock,
  HeartPulse,
  TriangleAlert,
  Wrench,
  MessageSquare,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLocalDb } from "@/components/providers/local-database-provider";
import type { Substitution } from "@/lib/types";

interface EventsPanelProps {
  matchId: string;
  setId: string | null;
  homeTeam: Team;
  awayTeam: Team;
  players: TeamMember[];
  playerById: Map<string, TeamMember>;
  managedTeamId: string;
  currentSet?: Set | null;
  currentHomeScore?: number;
  currentAwayScore?: number;
  currentPointNumber?: number;
  currentLineup?: Record<string, string>;
  onSubstitutionRecorded?: (substitution: Substitution) => Promise<void>;
}

const EVENT_ICONS = {
  substitution: Users,
  timeout: Clock,
  injury: HeartPulse,
  sanction: TriangleAlert,
  technical: Wrench,
  comment: MessageSquare,
};

export function EventsPanel({
  matchId,
  setId,
  homeTeam,
  awayTeam,
  players,
  playerById,
  managedTeamId,
  currentSet,
  currentHomeScore,
  currentAwayScore,
  currentPointNumber,
  currentLineup,
  onSubstitutionRecorded,
}: EventsPanelProps) {
  const t = useTranslations("matches");
  const { localDb: db } = useLocalDb();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<EventType | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedQuickEventType, setSelectedQuickEventType] = useState<EventType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Determine managed team and opponent team
  const managedTeam = managedTeamId === homeTeam.id ? homeTeam : awayTeam;
  const managedTeamSide = managedTeamId === homeTeam.id ? "home" : "away";

  // Load events
  useEffect(() => {
    loadEvents();
  }, [matchId, setId]);

  // Filter events when filter changes
  useEffect(() => {
    if (selectedFilter === "all") {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter((e) => e.event_type === selectedFilter));
    }
  }, [events, selectedFilter]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const eventDocs = await db?.events.find({
            selector: {
              set_id: setId,
              match_id: matchId,
            },
            sort: [{ created_at: "desc" }],
          }).exec();
      
      const sortedEvents = eventDocs ? Array.from(eventDocs.values()).map((doc) => doc.toJSON()) : [];
      setEvents(sortedEvents);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlayerName = (playerId: string): string => {
    const player = playerById.get(playerId);
    return player ? `#${player.number} ${player.name}` : "Unknown Player";
  };

  const renderEventDetails = (event: Event) => {
    // Cast to MatchEvent for type-safe details access
    const matchEvent = event as any;

    if (isSubstitutionEvent(matchEvent)) {
      const details = event.details as SubstitutionDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>{t("events.playerOutRequired")}:</span>
            <span className="font-medium">{getPlayerName(details.player_out_id)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("events.playerInRequired")}:</span>
            <span className="font-medium">{getPlayerName(details.player_in_id)}</span>
          </div>
          {details.comments && (
            <div className="pt-1 text-xs italic">{details.comments}</div>
          )}
        </div>
      );
    }

    if (isTimeoutEvent(matchEvent)) {
      const details = event.details as TimeoutDetails;
      return (
        <div className="text-xs text-muted-foreground">
          <div>{t("live.timeout")}: {details.duration}s</div>
          {details.timeout_type && <div>{t("events.timeoutType")}: {details.timeout_type}</div>}
          {details.requested_by && <div>Requested by: {details.requested_by}</div>}
        </div>
      );
    }

    if (isInjuryEvent(matchEvent)) {
      const details = event.details as InjuryDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{t("events.injuredPlayer")}: {event.player_id ? getPlayerName(event.player_id) : "Unknown"}</div>
          <div>{t("events.severity")}: <Badge variant="outline" className="text-xs">{details.severity}</Badge></div>
          <div>{details.description}</div>
          {details.medical_intervention && <div className="text-red-600">{t("events.medicalInterventionRequired")}</div>}
        </div>
      );
    }

    if (isSanctionEvent(matchEvent)) {
      const details = event.details as SanctionDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{t("events.sanction")}: <Badge variant="destructive" className="text-xs">{details.sanction_type.replace("_", " ")}</Badge></div>
          <div>{t("events.selectSanctionType")}: {details.target} {details.target_name && `(${details.target_name})`}</div>
          <div>{t("events.reasonRequired")}: {details.reason}</div>
          {details.point_penalty && <div className="text-red-600">{t("events.severity")}</div>}
        </div>
      );
    }

    if (isTechnicalEvent(matchEvent)) {
      const details = event.details as TechnicalDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{t("events.selectIssueType")}: {details.issue_type.replace("_", " ")}</div>
          <div>{details.description}</div>
          <div>{t("events.severity")}: <Badge variant={details.resolved ? "default" : "outline"} className="text-xs">
            {details.resolved ? "Resolved" : "Ongoing"}
          </Badge></div>
        </div>
      );
    }

    if (isCommentEvent(matchEvent)) {
      const details = event.details as CommentDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>{details.text}</div>
          {details.importance && (
            <Badge
              variant={
                details.importance === "high"
                  ? "destructive"
                  : details.importance === "medium"
                  ? "outline"
                  : "secondary"
              }
              className="text-xs"
            >
              {details.importance}
            </Badge>
          )}
          {details.author && <div className="text-xs italic">- {details.author}</div>}
        </div>
      );
    }

    return <div className="text-xs text-muted-foreground">{t("noDetailsAvailable")}</div>;
  };

  const getEventColorClass = (eventType: EventType) => {
    const colorMap = {
      substitution: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
      timeout: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
      injury: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
      sanction: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
      technical: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
      comment: "bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700",
    };
    return colorMap[eventType];
  };

  const handleQuickEvent = (eventType: EventType) => {
    setSelectedQuickEventType(eventType);
    setIsCreateDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setSelectedQuickEventType(null);
  };

  const handleEventSuccess = () => {
    handleDialogClose();
    loadEvents();
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3 space-y-2 sm:space-y-3 flex-shrink-0 overflow-visible p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Events {currentSet && (
                      <Badge variant="outline" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                        Set {currentSet.set_number}
                      </Badge>
                    )}</CardTitle>
          <div className="flex gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickEvent("substitution")}
              className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
            >
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
              <span className="hidden xs:inline">{t("live.substitution")}</span>
              <span className="xs:hidden">{t("stats.eventShort")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickEvent("timeout")}
              className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
            >
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
              {t("live.timeout")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(true)}
              className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Event Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedQuickEventType
                  ? `Add ${EVENT_TYPE_LABELS[selectedQuickEventType]}`
                  : "Create Event"
                }
              </DialogTitle>
            </DialogHeader>
            <EventForm
              matchId={matchId}
              setId={setId}
              teamId={managedTeam.id}
              team={managedTeamSide}
              players={players}
              preSelectedType={selectedQuickEventType || undefined}
              currentHomeScore={currentHomeScore}
              currentAwayScore={currentAwayScore}
              currentPointNumber={currentPointNumber}
              currentLineup={currentLineup}
              db={db}
              onSubstitutionRecorded={onSubstitutionRecorded}
              onSuccess={handleEventSuccess}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>

        {/* Filter */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          <Select
            value={selectedFilter}
            onValueChange={(value) => setSelectedFilter(value as EventType | "all")}
          >
            <SelectTrigger className="h-7 sm:h-8 text-[10px] sm:text-xs">
              <SelectValue placeholder={t("events.allEvents")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("events.allEvents")}</SelectItem>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
        <div className="flex-1 overflow-y-auto px-2 sm:px-4">
          <div className="space-y-1.5 sm:space-y-2 pb-4 pt-2">
            {isLoading ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">{t("events.selectSanctionType")}</p>
            ) : filteredEvents.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
                {selectedFilter === "all" ? t("events.noEventsRecorded") : t("events.noEventsOfType", { type: selectedFilter })}
              </p>
            ) : (
              filteredEvents.map((event) => {
                const Icon = EVENT_ICONS[event.event_type];
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "border-l-4 rounded-r-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2 transition-colors",
                      getEventColorClass(event.event_type)
                    )}
                  >
                    {/* Event Header */}
                    <div className="flex items-start justify-between gap-1 sm:gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm truncate">
                            {EVENT_TYPE_LABELS[event.event_type]}
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">
                            {format(new Date(event.timestamp), "HH:mm:ss")}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:gap-1 items-end shrink-0">
                        {event.team && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs max-w-[80px] sm:max-w-none truncate">
                            {event.team === "home" ? homeTeam.name : awayTeam.name}
                          </Badge>
                        )}
                        {(event.home_score !== undefined && event.home_score !== null &&
                          event.away_score !== undefined && event.away_score !== null) && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono">
                            {event.home_score}-{event.away_score}
                            {event.point_number && ` #${event.point_number}`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Event Details */}
                    {renderEventDetails(event)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
