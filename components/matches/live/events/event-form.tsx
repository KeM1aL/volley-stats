"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("matches");
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
        title: t("toast.error"),
        description: t("live.databaseNotAvailable"),
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
            title: t("toast.error"),
            description: t("live.cannotRecordSubstitution"),
          });
          return;
        }

        if (!onSubstitutionRecorded) {
          toast({
            variant: "destructive",
            title: t("toast.error"),
            description: t("live.substitutionHandlerNotAvailable"),
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
        title: t("events.eventCreated"),
        description: t("events.eventCreatedDesc"),
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create event:", error);
      toast({
        variant: "destructive",
        title: t("toast.error"),
        description: t("events.createEvent"),
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
                <FormLabel>{t("events.selectType")}</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedEventType(value as EventType);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("events.selectType")} />
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
                  <FormLabel>{t("events.form.playerOut")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectPlayerLeaving")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playersInLineup.length === 0 ? (
                        <SelectItem value="" disabled>
                          {t("events.form.noPlayersInLineup")}
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
                    {t("events.form.onlyPlayersInLineup")}
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
                  <FormLabel>{t("events.form.playerIn")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectPlayerEntering")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playersNotInLineup.length === 0 ? (
                        <SelectItem value="" disabled>
                          {t("events.form.noBenchPlayers")}
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
                    {t("events.form.onlyPlayersNotInLineup")}
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
                  <FormLabel>{t("events.form.comments")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("events.form.additionalNotes")} />
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
                  <FormLabel>{t("events.form.duration")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>{t("events.form.durationDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeout_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.form.timeoutType")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectType")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="regular">{t("events.enums.timeoutType.regular")}</SelectItem>
                      <SelectItem value="technical">{t("events.enums.timeoutType.technical")}</SelectItem>
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
                  <FormLabel>{t("events.form.injuredPlayer")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectPlayer")} />
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
                  <FormLabel>{t("events.form.severity")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectSeverity")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="minor">{t("events.enums.severity.minor")}</SelectItem>
                      <SelectItem value="moderate">{t("events.enums.severity.moderate")}</SelectItem>
                      <SelectItem value="severe">{t("events.enums.severity.severe")}</SelectItem>
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
                  <FormLabel>{t("events.form.description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("events.form.describeInjury")} />
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
                    <FormLabel>{t("events.form.medicalInterventionRequired")}</FormLabel>
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
                    <FormLabel>{t("events.form.playerContinuedPlaying")}</FormLabel>
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
                  <FormLabel>{t("events.form.sanctionType")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectSanctionType")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="warning">{t("events.enums.sanctionType.warning")}</SelectItem>
                      <SelectItem value="yellow_card">{t("events.enums.sanctionType.yellowCard")}</SelectItem>
                      <SelectItem value="red_card">{t("events.enums.sanctionType.redCard")}</SelectItem>
                      <SelectItem value="disqualification">
                        {t("events.enums.sanctionType.disqualification")}
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
                  <FormLabel>{t("events.form.target")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.whoReceivedSanction")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="player">{t("events.enums.sanctionTarget.player")}</SelectItem>
                      <SelectItem value="coach">{t("events.enums.sanctionTarget.coach")}</SelectItem>
                      <SelectItem value="staff">{t("events.enums.sanctionTarget.staff")}</SelectItem>
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
                  <FormLabel>{t("events.form.reason")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("events.form.reasonForSanction")} />
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
                    <FormLabel>{t("events.form.pointPenaltyAwarded")}</FormLabel>
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
                  <FormLabel>{t("events.form.issueType")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectIssueType")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equipment">{t("events.enums.issueType.equipment")}</SelectItem>
                      <SelectItem value="facility">{t("events.enums.issueType.facility")}</SelectItem>
                      <SelectItem value="score_dispute">
                        {t("events.enums.issueType.scoreDispute")}
                      </SelectItem>
                      <SelectItem value="other">{t("events.enums.issueType.other")}</SelectItem>
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
                  <FormLabel>{t("events.form.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("events.form.describeIssue")}
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
                    <FormLabel>{t("events.form.issueResolved")}</FormLabel>
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
                  <FormLabel>{t("events.form.comment")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("events.form.enterComment")}
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
                  <FormLabel>{t("events.form.importance")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("events.form.selectImportance")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">{t("events.enums.eventImportance.low")}</SelectItem>
                      <SelectItem value="medium">{t("events.enums.eventImportance.medium")}</SelectItem>
                      <SelectItem value="high">{t("events.enums.eventImportance.high")}</SelectItem>
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
              {t("common.actions.cancel")}
            </Button>
          )}
          <Button type="submit">{t("events.form.createEvent")}</Button>
        </div>
      </form>
    </Form>
  );
}
