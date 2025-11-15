"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventForm } from "./event-form";
import { TeamMember } from "@/lib/types";
import { EventType } from "@/lib/types/events";

interface QuickEventButtonsProps {
  matchId: string;
  setId: string | null;
  teamId: string | null;
  team: "home" | "away" | null;
  homeTeamPlayers?: TeamMember[];
  awayTeamPlayers?: TeamMember[];
  currentHomeScore?: number;
  currentAwayScore?: number;
  currentPointNumber?: number;
  onEventCreated?: () => void;
}

export function QuickEventButtons({
  matchId,
  setId,
  teamId,
  team,
  homeTeamPlayers = [],
  awayTeamPlayers = [],
  currentHomeScore,
  currentAwayScore,
  currentPointNumber,
  onEventCreated,
}: QuickEventButtonsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);

  const handleQuickEvent = (eventType: EventType) => {
    setSelectedEventType(eventType);
    setIsDialogOpen(true);
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedEventType(null);
    onEventCreated?.();
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setSelectedEventType(null);
  };

  const getDialogTitle = () => {
    switch (selectedEventType) {
      case "timeout":
        return "Add Timeout";
      case "substitution":
        return "Add Substitution";
      case "comment":
        return "Add Comment";
      default:
        return "Add Event";
    }
  };

  const getDialogDescription = () => {
    const scoreContext = currentHomeScore !== undefined && currentAwayScore !== undefined
      ? ` (Score: ${currentHomeScore}-${currentAwayScore}${currentPointNumber ? `, Point #${currentPointNumber}` : ''})`
      : '';

    switch (selectedEventType) {
      case "timeout":
        return `Record a timeout for this match${scoreContext}`;
      case "substitution":
        return `Record a player substitution${scoreContext}`;
      case "comment":
        return `Add a comment or note about the match${scoreContext}`;
      default:
        return "Record an event for this match";
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickEvent("timeout")}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4" />
          <span>Timeout</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickEvent("substitution")}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Substitution</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleQuickEvent("comment")}
          className="flex items-center gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Comment</span>
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          {selectedEventType && (
            <EventForm
              matchId={matchId}
              setId={setId}
              teamId={teamId}
              team={team}
              homeTeamPlayers={homeTeamPlayers}
              awayTeamPlayers={awayTeamPlayers}
              preSelectedType={selectedEventType}
              currentHomeScore={currentHomeScore}
              currentAwayScore={currentAwayScore}
              currentPointNumber={currentPointNumber}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
