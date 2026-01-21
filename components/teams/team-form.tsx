"use client";

import { useEffect, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useTeamApi } from "@/hooks/use-team-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Championship, Club, Team, TeamStatus } from "@/lib/types";
import { ChampionshipSelect } from "../championships/championship-select";
import { createClient } from "@/lib/supabase/client";
import { ClubSelect } from "../clubs/club-select";
import { GenericSelect } from "../ui/generic-select";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/contexts/subscription-context";
import { UpgradePrompt } from "../subscription/upgrade-prompt";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const supabase = createClient();

const formSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  championships: z.custom<Championship | null>(() => true).nullable(),
  clubs: z.custom<Club | null>(() => true).nullable(),
  status: z.enum(['incomplete', 'active', 'archived']),
});

type TeamFormProps = {
  team?: Team | null;
  onSuccess?: (id: string) => void;
  onClose?: () => void;
};

export function TeamForm({ team, onSuccess, onClose }: TeamFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const teamApi = useTeamApi();
  const router = useRouter();
  const { canCreateTeam, limits, refreshLimits } = useSubscription();
  const isEditMode = !!team;

  // Check if user is at their team limit (only for active teams)
  const isAtTeamLimit = !canCreateTeam;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team?.name || "",
      championships: team?.championships || null,
      clubs: team?.clubs || null,
      status: team?.status || 'active', // Default to 'active' for new teams created via full form
    },
  });

  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        championships: team.championships || null,
        clubs: team.clubs || null,
        status: team.status,
      });
    }
  }, [team, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Check team limit for new active teams (incomplete teams bypass the limit)
    if (!isEditMode && values.status === "active" && isAtTeamLimit) {
      setShowUpgradePrompt(true);
      return;
    }

    // When editing: check if changing status from non-active to active would exceed limit
    if (isEditMode && team.status !== "active" && values.status === "active" && isAtTeamLimit) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsLoading(true);
    try {
      if (isEditMode) {
        await teamApi.updateTeam(team.id, {
          name: values.name,
          championship_id: values.championships?.id ?? null,
          club_id: values.clubs?.id ?? null,
          status: values.status,
        });
        // Refresh limits if status changed
        if (team.status !== values.status) {
          await refreshLimits();
        }
        toast({
          title: "Team updated",
          description: "The team has been successfully updated.",
        });
        router.refresh();
        if (onSuccess) {
          onSuccess(team.id);
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const newTeam: Omit<Team, "championships" | "clubs"> = {
          id: crypto.randomUUID(),
          name: values.name,
          status: values.status,
          championship_id: values.championships?.id ?? null,
          club_id: values.clubs?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: session.user.id,
          ext_code: null,
          ext_source: null
        };

        const createdTeam = await teamApi.createTeam(newTeam);
        // Refresh limits after creating a team
        await refreshLimits();
        if (onSuccess) {
          onSuccess(createdTeam.id);
        }
        toast({
          title: "Team created",
          description: "Your new team has been created successfully.",
        });
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} team:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${
          isEditMode ? "update" : "create"
        } team. Please try again.`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Watch the status field to show warning when needed
  const watchedStatus = form.watch("status");
  const showLimitWarning = !isEditMode && isAtTeamLimit && watchedStatus === "active";

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {showLimitWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You&apos;ve reached your team limit ({limits?.teamsUsed}/{limits?.teamLimit}).
                Set status to &quot;Incomplete&quot; to create this team, or upgrade your plan.
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="name"
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
          name="championships"
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

        <FormField
          control={form.control}
          name="clubs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club</FormLabel>
              <FormControl>
                <ClubSelect
                  value={field.value}
                  onChange={field.onChange}
                  isClearable
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <GenericSelect
                  options={[
                    { label: 'Incomplete', value: 'incomplete' },
                    { label: 'Active', value: 'active' },
                    { label: 'Archived', value: 'archived' }
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Select status"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className={!onClose ? "w-full" : ""}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {isEditMode ? "Saving..." : "Creating Team..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Team"
            )}
          </Button>
        </div>
        </form>
      </Form>

      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        type="team"
        onUpgrade={() => {
          setShowUpgradePrompt(false);
          window.location.href = "/upgrade";
        }}
        onPurchase={() => {
          setShowUpgradePrompt(false);
          window.location.href = "/upgrade?product=team-slot";
        }}
      />
    </>
  );
}
