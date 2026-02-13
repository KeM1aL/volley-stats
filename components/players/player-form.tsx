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
import { useTranslations } from "next-intl";

type PlayerFormProps = {
  defaultValues?: Partial<TeamMember>;
  onSubmit: (values: any) => Promise<void>;
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
  const t = useTranslations('players');
  const tc = useTranslations('common');

  const formSchema = z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    number: z.coerce
      .number()
      .min(0, t('validation.numberPositive'))
      .max(99, t('validation.numberMax')).optional(),
    position: z.string().optional(),
    role: z.string().optional(),
    avatar_url: z.string().nullable(),
  });
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
              <FormLabel>{t('form.avatar')}</FormLabel>
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
              <FormLabel>{t('form.name')}</FormLabel>
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
              <FormLabel>{t('form.role')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectRole')} />
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
              <FormLabel>{t('form.number')}</FormLabel>
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
              <FormLabel>{t('form.position')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectPosition')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(PlayerRole).map((position) => (
                    <SelectItem key={position} value={position}>
                      {(() => {
                        switch (position) {
                          case PlayerRole.SETTER:
                            return t('positions.setter');
                          case PlayerRole.OPPOSITE:
                            return t('positions.opposite');
                          case PlayerRole.OUTSIDE_HITTER:
                            return t('positions.outsideHitter');
                          case PlayerRole.MIDDLE_HITTER:
                            return t('positions.middleHitter');
                          case PlayerRole.LIBERO:
                            return t('positions.libero');
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
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
