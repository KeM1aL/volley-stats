"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlayerRole, TeamMemberRole } from "@/lib/enums";
import { TeamMember } from "@/lib/types";
import { AvatarUpload } from "./avatar-upload";

const formSchema = z.object({
  name: z.string().min(1, "Player name is required"),
  number: z.coerce
    .number()
    .min(0, "Number must be positive")
    .max(99, "Number must be less than 100").optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  avatar_url: z.string().nullable(),
});

type PlayerFormProps = {
  defaultValues?: Partial<TeamMember>;
  onSubmit: (values: z.infer<typeof formSchema>) => Promise<void>;
  submitLabel: string;
  isSubmitting: boolean;
  onCancel: () => void;
};

export function PlayerForm({
  defaultValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  onCancel,
}: PlayerFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      number: defaultValues?.number || 0,
      position: defaultValues?.position || "",
      role: defaultValues?.role || "player",
      avatar_url: defaultValues?.avatar_url || null,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar</FormLabel>
              <FormControl>
                <AvatarUpload
                  playerId={defaultValues?.id}
                  currentAvatar={field.value}
                  onAvatarChange={(url) => field.onChange(url)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

       <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(TeamMemberRole).map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
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
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(PlayerRole).map((position) => (
                    <SelectItem key={position} value={position}>
                      {(() => {
                        switch (position) {
                          case PlayerRole.SETTER:
                            return "Setter";
                          case PlayerRole.OPPOSITE:
                            return "Opposite";
                          case PlayerRole.OUTSIDE_HITTER:
                            return "Outside Hitter";
                          case PlayerRole.MIDDLE_HITTER:
                            return "Middle Hitter";
                          case PlayerRole.LIBERO:
                            return "Libero";
                        }
                      })()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
