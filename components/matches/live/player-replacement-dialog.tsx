"use client";

import type {
  Match,
  Player,
  Team,
  Set,
  Substitution,
} from "@/lib/types";
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
  onSubstitution: (substitution: Substitution) => Promise<void>;
};

export default function PlayerReplacementDialog({
  match,
  set,
  players,
  playerById,
  onSubstitution,
}: PlayerReplacementDialogProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPlayerId: "",
      newPlayerId: "",
      comments: "",
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (
    values: z.infer<typeof formSchema>
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const substitution: Substitution = {
        id: crypto.randomUUID(),
        match_id: match.id,
        team_id: match.home_team_id,
        set_id: set.id,
        player_out_id: values.oldPlayerId,
        player_in_id: values.newPlayerId,
        position: Object.entries(set.current_lineup).find(
          ([_position, playerId]) => playerId === values.oldPlayerId
        )![0],
        comments: values.comments,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSubstitution(substitution);

      toast({
        title: "Replacement Successful",
        description: "The replacement was successful",
      });
    } catch (error) {
      toast({
        title: "Replacement Failed",
        description: "The replacement failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
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
              <DialogTrigger asChild>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  Perform Replacement
                </Button>
              </DialogTrigger>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
