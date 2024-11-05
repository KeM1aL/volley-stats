"use client";

import { useState } from "react";
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
import { Team } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/client";
import { useDb } from "@/components/providers/database-provider";

const formSchema = z.object({
  name: z.string().min(1, "Team name is required"),
});

type EditTeamDialogProps = {
  team: Team | null;
  onClose: () => void;
};

export function EditTeamDialog({ team, onClose }: EditTeamDialogProps) {
  const router = useRouter();
  const { db } = useDb();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team?.name || "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!team) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("teams")
        .update({ name: values.name })
        .eq("id", team.id)
        .select()
        .single();

      if (error) throw error;

      await db?.teams.findOne(team.id).update({
        $set: { name: values.name },
      });

      toast({
        title: "Team updated",
        description: "The team has been successfully updated.",
      });

      router.refresh();
      onClose();
    } catch (error) {
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