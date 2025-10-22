'use client';

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';

import { useTeamApi } from "@/hooks/use-team-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Championship, Team } from "@/lib/types";
import { ChampionshipSelect } from "../championships/championship-select";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const formSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  championship: z.custom<Championship | null>(() => true).nullable(),
});

type NewTeamFormProps = {
  onTeamCreated: (id: string) => void;
};

export function NewTeamForm({ onTeamCreated }: NewTeamFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teamApi = useTeamApi();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamName: "",
      championship: null,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const newTeam: Omit<Team, 'championship'> = {
        id: crypto.randomUUID(),
        name: values.teamName,
        championship_id: values.championship?.id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        club_id: null,
        user_id: session.user.id,
      };
      
      const createdTeam = await teamApi.createTeam(newTeam);
      onTeamCreated(createdTeam.id);
      
      toast({
        title: "Team created",
        description: "Your new team has been created successfully.",
      });
    } catch (error) {
      console.error("Failed to create team:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create team. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter team name" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="championship"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Championship</FormLabel>
              <FormControl>
                <ChampionshipSelect
                  value={field.value}
                  onChange={field.onChange}
                  isClearable
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Creating Team...
            </>
          ) : (
            "Create Team"
          )}
        </Button>
      </form>
    </Form>
  );
}