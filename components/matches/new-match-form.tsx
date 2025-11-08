"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Skeleton } from "../ui/skeleton";
import { Championship, Match, MatchFormat } from "@/lib/types";
import { ChampionshipSelect } from "../championships/championship-select";
import { MatchFormatSelect } from "../match-formats/match-format-select";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  homeTeamId: z.string().min(1, "Home team is required"),
  awayTeamId: z.string().min(1, "Away team is required"),
  date: z.date({ required_error: "Match date is required" }),
  championshipId: z.string().nullable().optional(),
  matchFormatId: z.string().min(1, "Match format is required"),
  location: z.string().optional(),
});

type NewMatchFormProps = {
  onMatchCreated: (id: string) => void;
  onCancel?: () => void;
};

export function NewMatchForm({ onMatchCreated, onCancel }: NewMatchFormProps) {
  const { localDb: db } = useLocalDb();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Array<{ id: string; name: string; championship_id: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [selectedMatchFormat, setSelectedMatchFormat] = useState<MatchFormat | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeTeamId: "",
      awayTeamId: "",
      date: new Date(),
      championshipId: null,
      matchFormatId: "",
      location: "",
    },
  });

  useEffect(() => {
    const loadTeams = async () => {
      if (!db) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, championship_id");
      if (error) throw error;

      const teamDocs = await db.teams.find().exec();
      setTeams(teamDocs.map((doc) => doc.toJSON()));
      setIsLoading(false);
    };

    loadTeams();
  }, [db]);

  // Handle championship change - auto-populate match format from championship's default
  useEffect(() => {
    if (selectedChampionship?.match_formats) {
      const defaultFormat = selectedChampionship.match_formats as any as MatchFormat;
      setSelectedMatchFormat(defaultFormat);
      form.setValue("matchFormatId", defaultFormat.id);
    }
  }, [selectedChampionship, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.homeTeamId === values.awayTeamId) {
      form.setError("awayTeamId", {
        message: "Away team must be different from home team",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const match = {
        id: crypto.randomUUID(),
        home_team_id: values.homeTeamId,
        away_team_id: values.awayTeamId,
        date: values.date.toISOString(),
        match_format_id: values.matchFormatId,
        championship_id: values.championshipId || null,
        season_id: null,
        location: values.location || null,
        status: "upcoming",
        home_score: 0,
        away_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Match;

      await db?.matches.insert(match);
      onMatchCreated(match.id);

      toast({
        title: "Match created",
        description: "Your new match has been created successfully.",
      });
    } catch (error) {
      console.error("Failed to create match:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create match. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-[68px] w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Match Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isSubmitting}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0) - 365 * 24 * 60 * 60 * 1000)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="homeTeamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home Team</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger disabled={isSubmitting}>
                    <SelectValue placeholder="Select home team" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
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
          name="awayTeamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Away Team</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger disabled={isSubmitting}>
                    <SelectValue placeholder="Select away team" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
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
          name="championshipId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Championship (Optional)</FormLabel>
              <FormControl>
                <ChampionshipSelect
                  value={selectedChampionship}
                  onChange={(championship) => {
                    setSelectedChampionship(championship);
                    field.onChange(championship?.id || null);
                  }}
                  isClearable
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="matchFormatId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Match Format</FormLabel>
              <FormControl>
                <MatchFormatSelect
                  value={selectedMatchFormat}
                  onChange={(format) => {
                    setSelectedMatchFormat(format);
                    field.onChange(format?.id || "");
                  }}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Main Gymnasium"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className={!onCancel ? "w-full" : ""}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating Match...
              </>
            ) : (
              "Create Match"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}