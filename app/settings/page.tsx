"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTheme } from "next-themes";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Team } from "@/lib/types";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  useSettings,
  settingsSchema,
  type Settings,
} from "@/hooks/use-settings";
import { removeRxDatabase } from "rxdb";
import { getDatabase, getDatabaseName, getStorage } from "@/lib/rxdb/database";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { useUnsentCountFor } from "@/hooks/use-unsent-guard";
import { MATCH_COLLECTIONS, type MatchCollectionName } from "@/lib/rxdb/sync/types";
import { useAuth } from "@/contexts/auth-context";
import {
  PasswordStrengthIndicator,
  calculatePasswordStrength,
} from "@/components/auth/password-strength-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import * as z from "zod";
import { FavoritesSection } from "@/components/settings/favorites-section";
import { updateLocale } from "@/lib/i18n/actions";
import { Locale } from "@/lib/i18n/config";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const STATS_TABLES = ["events", "score_points", "player_stats"] as const;

// Password change schema - Messages will be updated with translations in the component
const createPasswordChangeSchema = (t: any) =>
  z
    .object({
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("validation.passwordsMatch"),
      path: ["confirmPassword"],
    })
    .refine(
      (data) => {
        const { strength } = calculatePasswordStrength(data.newPassword);
        return strength !== "weak";
      },
      {
        message: t("validation.passwordTooWeak"),
        path: ["newPassword"],
      }
    );

// Email change schema
const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tSync = useTranslations("sync");
  // null (not counted yet) blocks too: clearing stays disabled until nothing unsent is confirmed.
  const unsentStats = useUnsentCountFor(STATS_TABLES);
  const unsentMatchData = useUnsentCountFor(MATCH_COLLECTIONS);
  const statsClearBlocked = unsentStats !== 0;
  const matchDataClearBlocked = unsentMatchData !== 0;
  const { localDb: db } = useLocalDb();
  const { theme, setTheme } = useTheme();
  const { session, reloadUser, user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingCache, setIsDeletingCache] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // Language options with translated labels
  const languages = [
    { value: "en", label: t('languages.en') },
    { value: "fr", label: t('languages.fr') },
    { value: "es", label: t('languages.es') },
    { value: "it", label: t('languages.it') },
    { value: "pt", label: t('languages.pt') },
  ];

  const {
    settings,
    isLoading: isLoadingSettings,
    updateSettings,
    resetSettings,
  } = useSettings();

  // Password change form
  const passwordChangeSchema = createPasswordChangeSchema(t);
  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Email change form
  const emailForm = useForm<z.infer<typeof emailChangeSchema>>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: {
      newEmail: "",
    },
  });

  const newPassword = passwordForm.watch("newPassword");
  const pendingEmail = session?.user?.new_email;

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    if (!isLoadingSettings) {
      form.reset(settings);
    }
  }, [settings, isLoadingSettings, form]);

  const onSubmit = async (values: Settings) => {
    setIsSaving(true);
    try {
      // Update language via i18n system if changed
      if (values.language !== settings.language) {
        const localeResult = await updateLocale(values.language as Locale);
        if (!localeResult.success) {
          throw new Error(t('sync.failedUpdateLanguage'));
        }
      }

      // Update other settings via existing system
      const result = await updateSettings(values);
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: t('toast.saved'),
        description: t('toast.savedDesc'),
      });

      // Refresh to apply new locale if language changed
      if (values.language !== settings.language) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        variant: "destructive",
        title: t("errors.generic"),
        description: t("toast.failedSaveSettings"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Whether changes of these tables are still unsent. Counted again right before deleting: the count
   * the buttons were enabled from may be stale (a change recorded or rejected since).
   */
  const hasUnsentChanges = async (tables: readonly MatchCollectionName[]): Promise<boolean> =>
    (await db!.pendingChanges.count({ tables: [...tables], statuses: ["pending", "rejected"] })) > 0;

  const notifyClearBlocked = () =>
    toast({ variant: "destructive", title: t("errors.generic"), description: tSync("guards.clearBlocked") });

  const handleResetLocalStats = async () => {
    setIsDeletingCache(true);
    try {
      if (await hasUnsentChanges(STATS_TABLES)) {
        notifyClearBlocked();
        return;
      }
      await db!.events?.remove();
      await db!.score_points?.remove();
      await db!.player_stats?.remove();
      toast({
        title: t('toast.cacheCleared'),
        description: t('localData.clearLocalStatsDesc'),
      });
    } catch (error) {
      console.error("Error resetting local stats:", error);
    } finally {
      setIsDeletingCache(false);
    }
  };

  const handleResetLocalMatches = async () => {
    setIsDeletingCache(true);
    try {
      if (await hasUnsentChanges(MATCH_COLLECTIONS)) {
        notifyClearBlocked();
        return;
      }
      await db!.events?.remove();
      await db!.score_points?.remove();
      await db!.player_stats?.remove();
      await db!.matches?.remove();
      await db!.sets?.remove();
      toast({
        title: t('toast.cacheCleared'),
        description: t('localData.clearLocalMatchesDesc'),
      });
    } catch (error) {
      console.error("Error resetting local matches:", error);
    } finally {
      setIsDeletingCache(false);
    }
  };

  const handleResetLocalTeams = async () => {
    setIsDeletingCache(true);
    try {
      if (await hasUnsentChanges(MATCH_COLLECTIONS)) {
        notifyClearBlocked();
        return;
      }
      await db!.events?.remove();
      await db!.score_points?.remove();
      await db!.player_stats?.remove();
      await db!.matches?.remove();
      await db!.sets?.remove();
      await db!.teams?.remove();
      await db!.team_members?.remove();
      toast({
        title: t('toast.cacheCleared'),
        description: t('localData.clearLocalTeamsDesc'),
      });
    } catch (error) {
      console.error("Error resetting local teams:", error);
    } finally {
      setIsDeletingCache(false);
    }
  };

  const handleResetLocalCache = async () => {
    setIsDeletingCache(true);
    try {
      if (await hasUnsentChanges(MATCH_COLLECTIONS)) {
        notifyClearBlocked();
        return;
      }
      await removeRxDatabase(getDatabaseName(), getStorage());

      toast({
        title: t('toast.cacheCleared'),
        description: t('toast.cacheDesc'),
      });
    } catch (error) {
      console.error("Error resetting local cache:", error);
    } finally {
      setIsDeletingCache(false);
    }
  };

  const handleResetSettings = () => {
    const defaults = resetSettings();
    form.reset(defaults);
    toast({
      title: t('toast.reset'),
      description: t('toast.resetDesc'),
    });
  };

  const handlePasswordChange = async (
    values: z.infer<typeof passwordChangeSchema>
  ) => {
    setIsChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) throw error;

      toast({
        title: t('account.passwordUpdated'),
        description: t('account.passwordUpdatedDesc'),
      });
      passwordForm.reset();
    } catch (error) {
      console.error("Failed to change password:", error);
      toast({
        variant: "destructive",
        title: t("errors.generic"),
        description:
          error instanceof Error ? error.message : t("toast.failedChangePassword"),
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleEmailChange = async (
    values: z.infer<typeof emailChangeSchema>
  ) => {
    setIsChangingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: values.newEmail,
      });

      if (error) throw error;

      toast({
        title: t('account.confirmEmailsSent'),
        description: t('account.confirmEmailsDesc'),
      });
      emailForm.reset();

      // Reload user to show pending email
      await reloadUser();
    } catch (error) {
      console.error("Failed to change email:", error);
      toast({
        variant: "destructive",
        title: t("errors.generic"),
        description:
          error instanceof Error ? error.message : t("toast.failedChangeEmail"),
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Account Security Card */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">{t('account.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('account.description')}
              </p>
            </div>

            {/* Change Password Section */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="font-medium">{t('account.changePassword')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('account.changePasswordDesc')}
                </p>
              </div>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.newPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PasswordStrengthIndicator password={newPassword} />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.confirmPassword')}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {t('account.updating')}
                      </>
                    ) : (
                      t('account.updatePassword')
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Change Email Section */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="font-medium">{t('account.emailAddress')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('account.emailAddressDesc')}
                </p>
              </div>

              {pendingEmail && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t('account.emailChangePending', {
                      oldEmail: session?.user?.email || '',
                      newEmail: pendingEmail
                    })}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>{t('account.currentEmail')}</Label>
                <Input
                  type="email"
                  value={session?.user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>

              {!pendingEmail && (
                <Form {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit(handleEmailChange)}
                    className="space-y-4"
                  >
                    <FormField
                      control={emailForm.control}
                      name="newEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('account.newEmail')}</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                          <FormDescription>
                            {t('account.confirmEmailDesc')}
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isChangingEmail}>
                      {isChangingEmail ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          {t('account.sending')}
                        </>
                      ) : (
                        t('account.updateEmail')
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Favorites Card */}
      {user && <FavoritesSection user={user} onUpdate={reloadUser} />}

      {/* Theme Selector - Standalone (not in form) */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">{t('preferences.title')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('preferences.description')}
              </p>
            </div>
            {mounted && (
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('preferences.theme')}</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t('preferences.themeLight')}</SelectItem>
                    <SelectItem value="dark">{t('preferences.themeDark')}</SelectItem>
                    <SelectItem value="system">{t('preferences.themeSystem')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('preferences.language')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('preferences.languagePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {languages.map((language) => (
                            <SelectItem
                              key={language.value}
                              value={language.value}
                            >
                              {language.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* <div className="space-y-4">
                <FormLabel>{t('preferences.notifications')}</FormLabel>
                <FormField
                  control={form.control}
                  name="notifications.matchReminders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>{t('preferences.matchReminders')}</FormLabel>
                        <FormDescription>
                          Receive notifications before your matches
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notifications.scoreUpdates"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>{t('preferences.scoreUpdates')}</FormLabel>
                        <FormDescription>
                          Get notified about score changes during matches
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div> */}

                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSettings}
                    disabled={isSaving}
                    className="w-full sm:w-auto"
                  >
                    {t('actions.resetToDefaults')}
                  </Button>
                  <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                    {isSaving ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {t('actions.saving')}
                      </>
                    ) : (
                      t('actions.saveChanges')
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>

      {/* Local database */}
      {db && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Label>{t('localData.title')}</Label>
              {(unsentMatchData ?? 0) > 0 && (
                <p className="text-sm text-destructive" data-testid="clear-blocked">
                  {tSync("guards.clearBlocked")}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {t('localData.clearLocalStats')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('localData.clearLocalStatsDesc')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleResetLocalStats()}
                    disabled={statsClearBlocked}
                    className="w-full sm:w-auto"
                  >
                    {t('localData.clear')}
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {t('localData.clearLocalMatches')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('localData.clearLocalMatchesDesc')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleResetLocalMatches()}
                    disabled={matchDataClearBlocked}
                    className="w-full sm:w-auto"
                  >
                    {t('localData.clear')}
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {t('localData.clearLocalTeams')}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t('localData.clearLocalTeamsDesc')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleResetLocalTeams()}
                    disabled={matchDataClearBlocked}
                    className="w-full sm:w-auto"
                  >
                    {t('localData.clear')}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeletingCache || matchDataClearBlocked}
                  onClick={() => void handleResetLocalCache()}
                >
                  {isDeletingCache ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      {t('localData.deleting')}
                    </>
                  ) : (
                    t('localData.clearAll')
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
