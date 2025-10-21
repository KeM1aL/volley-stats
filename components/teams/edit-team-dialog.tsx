'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Championship, Team } from "@/lib/types";
import { ChampionshipSelect } from "../championships/championship-select";
import { useTeamApi } from "@/hooks/use-team-api";

const formSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  championship: z.custom<Championship | null>(() => true).nullable(),
});

type EditTeamDialogProps = {
  team: (Team & { championship?: Championship }) | null;
  onClose: () => void;
};

export function EditTeamDialog({ team, onClose }: EditTeamDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teamApi = useTeamApi();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team?.name || "",
      championship: team?.championship || null,
    },
  });

  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        championship: team.championship || null,
      });
    }
  }, [team, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!team) return;

    setIsLoading(true);
    try {
      await teamApi.updateTeam(team.id, {
        name: values.name,
        championship_id: values.championship?.id ?? null,
      });

      toast({
        title: "Team updated",
        description: "The team has been successfully updated.",
      });

      router.refresh();
      onClose();
    } catch (error) {
      console.error("Failed to update team:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update team. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={!!team} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}