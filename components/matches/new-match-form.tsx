"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Button } from "@/components/ui/button";
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
import { useToast } from '@/hooks/use-toast';
import { createClient, supabase } from "@/lib/supabase/client";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Skeleton } from "../ui/skeleton";
import { Match } from "@/lib/supabase/types";

const formSchema = z.object({
  homeTeamId: z.string().min(1, "Home team is required"),
  awayTeamId: z.string().min(1, "Away team is required"),
});

type NewMatchFormProps = {
  onMatchCreated: (id: string) => void;
};

export function NewMatchForm({ onMatchCreated }: NewMatchFormProps) {
  const { db } = useLocalDb();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const loadTeams = async () => {
      if(!db) return;

      const supabase = createClient();
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw error;

      const teamDocs = await db.teams.find().exec();
      setTeams(teamDocs.map((doc) => doc.toJSON()));
      setIsLoading(false);
    };

    loadTeams();
  }, [db]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.homeTeamId === values.awayTeamId) {
      form.setError("awayTeamId", {
        message: "Away team must be different from home team"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const match = {
        id: crypto.randomUUID(),
        home_team_id: values.homeTeamId,
        away_team_id: values.awayTeamId,
        date: new Date().toISOString(), // TODO Date must be in the form
        status: "upcoming",
        home_score: 0,
        away_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Match;

      // const { data, error } = await supabase
      //   .from("matches")
      //   .insert({
      //     home_team_id: values.homeTeamId,
      //     away_team_id: values.awayTeamId,
      //     date: new Date().toISOString(),
      //     status: "upcoming",
      //     home_score: 0,
      //     away_score: 0,
      //   })
      //   .select()
      //   .single();

      // if (error) throw error;

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
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Creating Match...
            </>
          ) : (
            "Create Match"
          )}
        </Button>
      </form>
    </Form>
  );
}