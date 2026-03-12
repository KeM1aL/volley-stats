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
import { ChampionshipSelectWithQuickCreate } from "../championships/championship-select-with-quick-create";
import { createClient } from "@/lib/supabase/client";
import { ClubSelectWithQuickCreate } from "../clubs/club-select-with-quick-create";
import { GenericSelect } from "../ui/generic-select";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const supabase = createClient();

type TeamFormProps = {
  team?: Team | null;
  onSuccess?: (id: string) => void;
  onClose?: () => void;
};

export function TeamForm({ team, onSuccess, onClose }: TeamFormProps) {
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teamApi = useTeamApi();
  const router = useRouter();
  const isEditMode = !!team;

  const formSchema = z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    championships: z.custom<Championship | null>(() => true).nullable(),
    clubs: z.custom<Club | null>(() => true).nullable(),
    status: z.enum(['incomplete', 'active', 'archived']),
  });

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
    setIsLoading(true);
    try {
      if (isEditMode) {
        await teamApi.updateTeam(team.id, {
          name: values.name,
          championship_id: values.championships?.id ?? null,
          club_id: values.clubs?.id ?? null,
          status: values.status,
        });
        toast({
          title: t('toast.updated'),
          description: t('toast.updatedDesc'),
        });
        router.refresh();
        if (onSuccess) {
          onSuccess(team.id);
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error(tc('errors.notAuthenticated'));

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
        if (onSuccess) {
          onSuccess(createdTeam.id);
        }
        toast({
          title: t('toast.created'),
          description: t('toast.createdDesc'),
        });
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} team:`, error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: isEditMode ? t('toast.updateError') : t('toast.createError'),
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('form.namePlaceholder')}
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
              <FormLabel>{t('form.championship')}</FormLabel>
              <FormControl>
                <ChampionshipSelectWithQuickCreate
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
              <FormLabel>{t('form.club')}</FormLabel>
              <FormControl>
                <ClubSelectWithQuickCreate
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
              <FormLabel>{t('form.status')}</FormLabel>
              <FormControl>
                <GenericSelect
                  options={[
                    { label: t('status.incomplete'), value: 'incomplete' },
                    { label: t('status.active'), value: 'active' },
                    { label: t('status.archived'), value: 'archived' }
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('form.statusPlaceholder')}
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
              {tc('actions.cancel')}
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
                {isEditMode ? t('form.saving') : t('form.creating')}
              </>
            ) : isEditMode ? (
              t('form.saveChanges')
            ) : (
              t('form.createTeam')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
