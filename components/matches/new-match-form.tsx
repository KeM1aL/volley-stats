"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Championship, Match, MatchFormat, Team } from "@/lib/types";
import { useTranslations } from "next-intl";
import { ChampionshipSelect } from "../championships/championship-select";
import { MatchFormatSelect } from "../match-formats/match-format-select";
import { TeamSelectWithQuickCreate } from "../teams/team-select-with-quick-create";
import { cn } from "@/lib/utils";
import { useMatchApi } from "@/hooks/use-match-api";

type NewMatchFormProps = {
  onMatchCreated: (id: string) => void;
  onCancel?: () => void;
};

export function NewMatchForm({ onMatchCreated, onCancel }: NewMatchFormProps) {
  const { toast } = useToast();
  const matchApi = useMatchApi();
  const t = useTranslations('matches');
  const tc = useTranslations('common');

  const formSchema = z.object({
    homeTeamId: z.string().min(1, t('validation.homeTeamRequired')),
    awayTeamId: z.string().min(1, t('validation.awayTeamRequired')),
    date: z.date({ required_error: t('validation.dateRequired') }),
    championshipId: z.string().nullable().optional(),
    matchFormatId: z.string().min(1, t('validation.formatRequired')),
    location: z.string().optional(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [selectedMatchFormat, setSelectedMatchFormat] = useState<MatchFormat | null>(null);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState<Team | null>(null);
  const [selectedAwayTeam, setSelectedAwayTeam] = useState<Team | null>(null);

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
        message: t('validation.teamsMustDiffer'),
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

      await matchApi.createMatch(match);
      onMatchCreated(match.id);

      toast({
        title: t('toast.created'),
        description: t('toast.createdDesc'),
      });
    } catch (error) {
      console.error("Failed to create match:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: t('toast.createError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t('form.matchDate')}</FormLabel>
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
                        <span>{t('form.pickDate')}</span>
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
          name="championshipId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.championshipOptional')}</FormLabel>
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
          name="homeTeamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.homeTeam')}</FormLabel>
              <FormControl>
                <TeamSelectWithQuickCreate
                  value={selectedHomeTeam}
                  onChange={(team) => {
                    setSelectedHomeTeam(team);
                    field.onChange(team?.id || "");
                  }}
                  disabled={isSubmitting}
                  defaultChampionshipId={form.watch('championshipId')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="awayTeamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.awayTeam')}</FormLabel>
              <FormControl>
                <TeamSelectWithQuickCreate
                  value={selectedAwayTeam}
                  onChange={(team) => {
                    setSelectedAwayTeam(team);
                    field.onChange(team?.id || "");
                  }}
                  disabled={isSubmitting}
                  defaultChampionshipId={form.watch('championshipId')}
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
              <FormLabel>{t('form.matchFormat')}</FormLabel>
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
              <FormLabel>{t('form.locationOptional')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.locationPlaceholder')}
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
              {tc('actions.cancel')}
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
                {t('form.creatingMatch')}
              </>
            ) : (
              t('form.createMatch')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}