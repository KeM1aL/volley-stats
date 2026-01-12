"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTeamApi } from "@/hooks/use-team-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Team } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const formSchema = z.object({
  name: z.string().min(1, "Team name is required"),
});

type QuickCreateTeamDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (teamId: string) => void;
  defaultChampionshipId?: string | null;
  defaultName?: string;
};

export function QuickCreateTeamDialog({
  open,
  onClose,
  onSuccess,
  defaultChampionshipId,
  defaultName,
}: QuickCreateTeamDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teamApi = useTeamApi();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultName || "",
    },
  });

  // Update form value when dialog opens with new defaultName
  useEffect(() => {
    if (open && defaultName) {
      form.setValue("name", defaultName);
    }
  }, [open, defaultName, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const newTeam: Omit<Team, "championships" | "clubs"> = {
        id: crypto.randomUUID(),
        name: values.name,
        status: "incomplete", // Quick-created teams are marked as incomplete
        championship_id: defaultChampionshipId ?? null, // Auto-inherit championship if provided
        club_id: null, // No club for quick-created teams
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: session.user.id,
        ext_code: null,
        ext_source: null,
      };

      const createdTeam = await teamApi.createTeam(newTeam);

      toast({
        title: "Team created",
        description: `${values.name} has been created. You can complete the team details later.`,
      });

      form.reset();
      onSuccess(createdTeam.id);
      onClose();
    } catch (error) {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Create Team</DialogTitle>
          <DialogDescription>
            Create a new team with just a name. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
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
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Team"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
