"use client";

import type { Match, Player, Team, Set } from "@/lib/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Replace, Volleyball } from "lucide-react";
import { useEffect, useState } from "react";
import { toast, useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "@/components/ui/form";

const formSchema = z.object({
  oldPlayerId: z.string().min(1, "Player name is required"),
  newPlayerId: z.string().min(1, "Position is required"),
  comments: z.string(),
});

type PlayerReplacementDialogProps = {
  match: Match;
  set: Set;
  players: Player[];
  playerById: Map<string, Player>;
};

export default function PlayerReplacementDialog({
  match,
  set,
  players,
  playerById,
}: PlayerReplacementDialogProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPlayerId: "",
      newPlayerId: "",
      comments: null,
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (
    values: z.infer<typeof formSchema>
  ): Promise<void> => {
    console.log(values);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Replace className="h-6 w-6 mr-2" />
          Replace Player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Replace Player</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="oldPlayerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leaving Player</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(set.current_lineup)
                            .map((playerId) => playerById.get(playerId))
                            .map((player) => (
                              <SelectItem key={player!.id} value={player!.id}>
                                {player!.number} - {player!.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPlayerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Player</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {players
                            .filter((player) =>
                              Object.values(set.current_lineup).every(
                                (playerId) => playerId !== player.id
                              )
                            )
                            .map((player) => (
                              <SelectItem key={player!.id} value={player!.id}>
                                {player!.number} - {player!.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
            Perform Replacement
          </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
