"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { supabase } from "@/lib/supabase/client";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Team } from "@/lib/supabase/types";

const formSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
});

type NewTeamFormProps = {
  onTeamCreated: (id: string) => void;
};

export function NewTeamForm({ onTeamCreated }: NewTeamFormProps) {
  const { localDb: db } = useLocalDb();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const team = {
        id: crypto.randomUUID(),
        name: values.teamName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: session.user.id,
      } as Team;

      // const { data, error } = await supabase
      //   .from("teams")
      //   .insert(team)
      //   .select()
      //   .single();

      // if (error) throw error;

      await db?.teams.insert(team);
      onTeamCreated(team.id);
      
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