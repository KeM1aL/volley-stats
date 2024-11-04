"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useDb } from "@/components/providers/database-provider";
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

const formSchema = z.object({
  teamName: z.string(),
});

type NewTeamFormProps = {
  onTeamCreated: (id: string) => void;
};

export function NewTeamForm({ onTeamCreated }: NewTeamFormProps) {
  const { db } = useDb();
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

      const { data, error } = await supabase
        .from("teams")
        .insert({
          name: values.teamName,
          created_at: new Date().toISOString(),
          user_id: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await db?.teams.insert(data);
      onTeamCreated(data.id);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create team",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="teamName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input type="text" placeholder="Choose a name" onChange={field.onChange} defaultValue={field.value} />
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          Create Team
        </Button>
      </form>
    </Form>
  );
}