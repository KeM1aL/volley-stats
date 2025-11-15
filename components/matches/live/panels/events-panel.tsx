"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEventApi } from "@/hooks/use-event-api";
import { Event, TeamMember, Team } from "@/lib/types";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface EventsPanelProps {
  matchId: string;
  setId: string | null;
  homeTeam: Team;
  awayTeam: Team;
  homeTeamPlayers: TeamMember[];
  awayTeamPlayers: TeamMember[];
  managedTeamId: string;
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
  homeTeamPlayers,
  awayTeamPlayers,
  managedTeamId,
}: EventsPanelProps) {
  const eventApi = useEventApi();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<EventType | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Determine managed team and opponent team
  const managedTeam = managedTeamId === homeTeam.id ? homeTeam : awayTeam;
  const managedTeamPlayers = managedTeamId === homeTeam.id ? homeTeamPlayers : awayTeamPlayers;
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
      const matchEvents = await eventApi.getMatchEvents(matchId);
      // Filter by set if setId is provided
      const relevantEvents = setId
        ? matchEvents.filter((e) => e.set_id === setId)
        : matchEvents;
      setEvents(relevantEvents);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlayerName = (playerId: string): string => {
    const allPlayers = [...homeTeamPlayers, ...awayTeamPlayers];
    const player = allPlayers.find((p) => p.id === playerId);
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
            <span>Out:</span>
            <span className="font-medium">{getPlayerName(details.player_out_id)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>In:</span>
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
          <div>Duration: {details.duration}s</div>
          {details.timeout_type && <div>Type: {details.timeout_type}</div>}
          {details.requested_by && <div>Requested by: {details.requested_by}</div>}
        </div>
      );
    }

    if (isInjuryEvent(matchEvent)) {
      const details = event.details as InjuryDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Player: {event.player_id ? getPlayerName(event.player_id) : "Unknown"}</div>
          <div>Severity: <Badge variant="outline" className="text-xs">{details.severity}</Badge></div>
          <div>{details.description}</div>
          {details.medical_intervention && <div className="text-red-600">Medical intervention required</div>}
        </div>
      );
    }

    if (isSanctionEvent(matchEvent)) {
      const details = event.details as SanctionDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Type: <Badge variant="destructive" className="text-xs">{details.sanction_type.replace("_", " ")}</Badge></div>
          <div>Target: {details.target} {details.target_name && `(${details.target_name})`}</div>
          <div>Reason: {details.reason}</div>
          {details.point_penalty && <div className="text-red-600">Point penalty awarded</div>}
        </div>
      );
    }

    if (isTechnicalEvent(matchEvent)) {
      const details = event.details as TechnicalDetails;
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <div>Issue: {details.issue_type.replace("_", " ")}</div>
          <div>{details.description}</div>
          <div>Status: <Badge variant={details.resolved ? "default" : "outline"} className="text-xs">
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

    return <div className="text-xs text-muted-foreground">No details available</div>;
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Events</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              <EventForm
                matchId={matchId}
                setId={setId}
                teamId={managedTeam.id}
                team={managedTeamSide}
                homeTeamPlayers={homeTeamPlayers}
                awayTeamPlayers={awayTeamPlayers}
                onSuccess={() => {
                  setIsCreateDialogOpen(false);
                  loadEvents();
                }}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedFilter}
            onValueChange={(value) => setSelectedFilter(value as EventType | "all")}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4">
          <div className="space-y-2 pb-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading events...</p>
            ) : filteredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {selectedFilter === "all" ? "No events recorded yet" : `No ${selectedFilter} events`}
              </p>
            ) : (
              filteredEvents.map((event) => {
                const Icon = EVENT_ICONS[event.event_type];
                return (
                  <div
                    key={event.id}
                    className={cn(
                      "border-l-4 rounded-r-lg p-3 space-y-2 transition-colors",
                      getEventColorClass(event.event_type)
                    )}
                  >
                    {/* Event Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Icon className="h-4 w-4 shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {EVENT_TYPE_LABELS[event.event_type]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(event.timestamp), "HH:mm:ss")}
                          </div>
                        </div>
                      </div>
                      {event.team && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {event.team === "home" ? homeTeam.name : awayTeam.name}
                        </Badge>
                      )}
                    </div>

                    {/* Event Details */}
                    {renderEventDetails(event)}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
