"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  EventType,
  CreateEventPayload,
  EVENT_TYPE_LABELS,
} from "@/lib/types/events";
import { TeamMember, Substitution } from "@/lib/types";
import type { VolleyballDatabase } from "@/lib/rxdb/database";
import { PlayerPosition } from "@/lib/enums";

// Base schema for all events
const baseEventSchema = z.object({
  event_type: z.enum([
    "substitution",
    "timeout",
    "injury",
    "sanction",
    "technical",
    "comment",
  ]),
});

// Substitution schema
const substitutionSchema = baseEventSchema.extend({
  event_type: z.literal("substitution"),
  player_in_id: z.string().min(1, "Player in is required"),
  player_out_id: z.string().min(1, "Player out is required"),
  position: z.string().optional(),
  comments: z.string().optional(),
});

// Timeout schema
const timeoutSchema = baseEventSchema.extend({
  event_type: z.literal("timeout"),
  duration: z.number().min(1).max(120),
  timeout_type: z.enum(["regular", "technical"]).optional(),
  requested_by: z.string().optional(),
  comments: z.string().optional(),
});

// Injury schema
const injurySchema = baseEventSchema.extend({
  event_type: z.literal("injury"),
  player_id: z.string().min(1, "Player is required"),
  severity: z.enum(["minor", "moderate", "severe"]),
  body_part: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  medical_intervention: z.boolean(),
  player_continued: z.boolean(),
  substitution_made: z.boolean(),
  comments: z.string().optional(),
});

// Sanction schema
const sanctionSchema = baseEventSchema.extend({
  event_type: z.literal("sanction"),
  sanction_type: z.enum([
    "warning",
    "yellow_card",
    "red_card",
    "disqualification",
  ]),
  target: z.enum(["player", "coach", "staff"]),
  target_id: z.string().optional(),
  target_name: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  point_penalty: z.boolean(),
  comments: z.string().optional(),
});

// Technical issue schema
const technicalSchema = baseEventSchema.extend({
  event_type: z.literal("technical"),
  issue_type: z.enum(["equipment", "facility", "score_dispute", "other"]),
  description: z.string().min(1, "Description is required"),
  affected_team: z.enum(["home", "away"]).optional(),
  resolution_time: z.number().optional(),
  resolved: z.boolean(),
  comments: z.string().optional(),
});

// Comment schema
const commentSchema = baseEventSchema.extend({
  event_type: z.literal("comment"),
  text: z.string().min(1, "Comment text is required"),
  author: z.string().optional(),
  importance: z.enum(["low", "medium", "high"]).optional(),
  category: z.string().optional(),
});

// Union schema
const eventFormSchema = z.discriminatedUnion("event_type", [
  substitutionSchema,
  timeoutSchema,
  injurySchema,
  sanctionSchema,
  technicalSchema,
  commentSchema,
]);

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  matchId: string;
  setId: string | null;
  teamId: string | null;
  team: "home" | "away" | null;
  players?: TeamMember[];
  preSelectedType?: EventType;
  currentHomeScore?: number;
  currentAwayScore?: number;
  currentPointNumber?: number;
  currentLineup?: Record<string, string>;
  db: VolleyballDatabase | null;
  onSubstitutionRecorded?: (substitution: Substitution) => Promise<void>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EventForm({
  matchId,
  setId,
  teamId,
  team,
  players = [],
  preSelectedType,
  currentHomeScore,
  currentAwayScore,
  currentPointNumber,
  currentLineup,
  db,
  onSubstitutionRecorded,
  onSuccess,
  onCancel,
}: EventFormProps) {
  const { toast } = useToast();
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(
    preSelectedType || null
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      event_type: preSelectedType || "",
      // Timeout defaults
      duration: 30,
      timeout_type: "regular",
      requested_by: "",
      // Substitution defaults
      player_in_id: "",
      player_out_id: "",
      position: "",
      // Injury defaults
      player_id: "",
      severity: "minor",
      body_part: "",
      description: "",
      medical_intervention: false,
      player_continued: false,
      substitution_made: false,
      // Sanction defaults
      sanction_type: "warning",
      target: "player",
      target_id: "",
      target_name: "",
      reason: "",
      point_penalty: false,
      // Technical defaults
      issue_type: "equipment",
      affected_team: undefined,
      resolution_time: undefined,
      resolved: false,
      // Comment defaults
      text: "",
      author: "",
      importance: "medium",
      category: "",
      // General
      comments: "",
    } as any, // Using 'as any' because different event types have different required fields
  });

  const onSubmit = async (values: EventFormValues) => {
    if (!db) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Database not available",
      });
      return;
    }

    try {
      // Handle substitution via SubstitutionCommand
      if (values.event_type === "substitution") {
        const substitutionValues = values as z.infer<typeof substitutionSchema>;

        if (!setId) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Cannot record substitution without an active set",
          });
          return;
        }

        if (!onSubstitutionRecorded) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Substitution handler not available",
          });
          return;
        }

        const position = Object.keys(currentLineup!).find((key) => currentLineup![key] === substitutionValues.player_out_id);
        const substitution: Substitution = {
          id: uuid(),
          match_id: matchId,
          set_id: setId,
          team_id: teamId!,
          player_in_id: substitutionValues.player_in_id,
          player_out_id: substitutionValues.player_out_id,
          position: position ?? "",
          comments: substitutionValues.comments ?? "",
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Call the substitution callback (which will execute SubstitutionCommand)
        await onSubstitutionRecorded(substitution);

        form.reset();
        onSuccess?.();
        return;
      }

      // For all other event types, write directly to RxDB
      const timestamp = new Date().toISOString();

      // Extract player_id for events that have it
      let player_id: string | null = null;
      if (values.event_type === "injury") {
        player_id = (values as z.infer<typeof injurySchema>).player_id;
      }

      const event = {
        id: uuid(),
        match_id: matchId,
        set_id: setId,
        team_id: teamId,
        event_type: values.event_type,
        timestamp,
        team,
        player_id,
        details: { ...values },
        home_score: currentHomeScore ?? null,
        away_score: currentAwayScore ?? null,
        point_number: currentPointNumber ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await db.events.insert(event);

      toast({
        title: "Event created",
        description: `${
          EVENT_TYPE_LABELS[values.event_type]
        } event has been recorded.`,
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create event:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create event. Please try again.",
      });
    }
  };

  // Filter players based on current lineup for substitutions
  const lineupPlayerIds = currentLineup
    ? new Set(Object.values(currentLineup))
    : new Set<string>();
  const playersInLineup = players.filter((p) => lineupPlayerIds.has(p.id));
  const playersNotInLineup = players.filter((p) => !lineupPlayerIds.has(p.id));

  const availablePlayers = players;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Event Type Selector - Hidden when preSelectedType is provided */}
        {!preSelectedType && (
          <FormField
            control={form.control}
            name="event_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Type</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedEventType(value as EventType);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Substitution Fields */}
        {selectedEventType === "substitution" && (
          <>
            <FormField
              control={form.control}
              name="player_out_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player Out (currently in lineup)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select player leaving" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playersInLineup.length === 0 ? (
                        <SelectItem value="" disabled>
                          No players in lineup
                        </SelectItem>
                      ) : (
                        playersInLineup.map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Only players currently on the court can be substituted out
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="player_in_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player In (on the bench)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select player entering" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playersNotInLineup.length === 0 ? (
                        <SelectItem value="" disabled>
                          No bench players available
                        </SelectItem>
                      ) : (
                        playersNotInLineup.map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            #{player.number} - {player.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Only players not currently in the lineup can enter
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Timeout Fields */}
        {selectedEventType === "timeout" && (
          <>
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Typically 30 or 60 seconds</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeout_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Injury Fields */}
        {selectedEventType === "injury" && (
          <>
            <FormField
              control={form.control}
              name="player_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Injured Player</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select player" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePlayers.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          #{player.number} - {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the injury..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medical_intervention"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Medical intervention required</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="player_continued"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Player continued playing</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}

        {/* Sanction Fields */}
        {selectedEventType === "sanction" && (
          <>
            <FormField
              control={form.control}
              name="sanction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sanction Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sanction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="yellow_card">Yellow Card</SelectItem>
                      <SelectItem value="red_card">Red Card</SelectItem>
                      <SelectItem value="disqualification">
                        Disqualification
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Who received the sanction?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Reason for sanction..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="point_penalty"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Point penalty awarded</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}

        {/* Technical Issue Fields */}
        {selectedEventType === "technical" && (
          <>
            <FormField
              control={form.control}
              name="issue_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="facility">Facility</SelectItem>
                      <SelectItem value="score_dispute">
                        Score Dispute
                      </SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe the technical issue..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="resolved"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Issue resolved</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}

        {/* Comment Fields */}
        {selectedEventType === "comment" && (
          <>
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter your comment..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="importance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Importance</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select importance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Form Actions */}
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">Create Event</Button>
        </div>
      </form>
    </Form>
  );
}
