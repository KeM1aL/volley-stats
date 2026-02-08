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
import { useTranslations } from "next-intl";

const supabase = createClient();

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
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const teamApi = useTeamApi();

  const formSchema = z.object({
    name: z.string().min(1, t('validation.nameRequired')),
  });

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
      if (!session) throw new Error(tc('errors.notAuthenticated'));

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
        title: t('toast.created'),
        description: t('quickCreate.completeDesc', { name: values.name }),
      });

      form.reset();
      onSuccess(createdTeam.id);
      onClose();
    } catch (error) {
      console.error("Error creating team:", error);
      toast({
        title: t('toast.error'),
        description: t('toast.createError'),
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
          <DialogTitle>{t('quickCreate.title')}</DialogTitle>
          <DialogDescription>
            {t('quickCreate.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {t('quickCreate.creating')}
                  </>
                ) : (
                  t('form.createTeam')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
