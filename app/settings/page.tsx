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
import { removeRxDatabase, RxCollection } from "rxdb";
import { getDatabase, getDatabaseName, getStorage } from "@/lib/rxdb/database";
import { Label } from "@/components/ui/label";
import { CollectionName } from "@/lib/rxdb/schema";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { chunk, delay } from "@/lib/utils";
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
  const { localDb: db } = useLocalDb();
  const { theme, setTheme } = useTheme();
  const { session, reloadUser, user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingCache, setIsDeletingCache] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const performMatchSync = async () => {
    if (!db) return;
    if (!matchId) return;

    setIsSyncing(true);
    try {
      const supabase = createClient();
      const doc = await db.matches.findOne(matchId).exec();
      if (doc) {
        const { error: updateError } = await supabase
          .from("matches")
          .update(doc.toMutableJSON())
          .eq("id", doc.id);
        if (updateError) throw updateError;
        toast({
          title: t("sync.title"),
          description: t("sync.matchSynced"),
        });
      }
      const collections = new Map<CollectionName, RxCollection>([
        ["matches", db.matches],
        ["sets", db.sets],
        ["player_stats", db.player_stats],
        ["score_points", db.score_points],
        ["events", db.events],
      ]);
      const entries = Array.from(collections.entries());
      for (const [name, collection] of entries) {
        let selector;
        if (name === "matches") {
          selector = {
            id: matchId,
          };
        } else {
          selector = {
            match_id: matchId,
          };
        }
        const docs = await collection
          .find({
            selector: selector,
            sort: [{ created_at: "asc" }],
          })
          .exec();
        toast({
          title: t("sync.title"),
          description: t("sync.dataToSync", { name, count: docs.length }),
        });
        if (docs) {
          const data = Array.from(docs.values()).map((doc) => doc.toJSON());

          const chunks = chunk(data, 20);
          const chunkSize = chunks.length;
          for (let index = 0; index < chunkSize; index++) {
            const chunk = chunks[index];

            const { error: updateError } = await supabase
              .from(name as any)
              .upsert(chunk)
              .select();
            if (updateError) throw updateError;
            toast({
              title: t("sync.title"),
              description: t("sync.dataSynced", { name, index, chunkSize }),
            });
            await delay(1000);
          }
          await delay(1000);
        }
        toast({
          title: t("sync.title"),
          description: t("sync.allDataSynced"),
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: t("errors.generic"),
        description:
          t("sync.error"),
      });
    } finally {
      setMatchId(null);
      setIsSyncing(false);
    }
  };

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

  const handleResetLocalStats = (loadingIndicator: boolean = true) => {
    if (loadingIndicator) setIsDeletingCache(true);
    try {
      db!.events?.remove();
      db!.score_points?.remove();
      db!.player_stats?.remove();
      if (loadingIndicator) {
        toast({
          title: t('toast.cacheCleared'),
          description: t('localData.clearLocalStatsDesc'),
        });
      }
    } catch (error) {
      console.error("Error resetting local stats:", error);
    } finally {
      if (loadingIndicator) setIsDeletingCache(false);
    }
  };

  const handleResetLocalMatches = (loadingIndicator: boolean = true) => {
    if (loadingIndicator) setIsDeletingCache(true);
    try {
      handleResetLocalStats(false);
      db!.matches?.remove();
      db!.sets?.remove();
      if (loadingIndicator) {
        toast({
          title: t('toast.cacheCleared'),
          description: t('localData.clearLocalMatchesDesc'),
        });
      }
    } catch (error) {
      console.error("Error resetting local matches:", error);
    } finally {
      if (loadingIndicator) setIsDeletingCache(false);
    }
  };

  const handleResetLocalTeams = (loadingIndicator: boolean = true) => {
    if (loadingIndicator) setIsDeletingCache(true);
    try {
      handleResetLocalMatches(false);
      db!.teams?.remove();
      db!.team_members?.remove();
      if (loadingIndicator) {
        toast({
          title: t('toast.cacheCleared'),
          description: t('localData.clearLocalTeamsDesc'),
        });
      }
    } catch (error) {
      console.error("Error resetting local teams:", error);
    } finally {
      if (loadingIndicator) setIsDeletingCache(false);
    }
  };

  const handleResetLocalCache = () => {
    setIsDeletingCache(true);
    try {
      removeRxDatabase(getDatabaseName(), getStorage());

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
                        defaultValue={field.value}
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
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 gap-3">
                  <div className="space-y-2 flex-1">
                    <Label className="text-sm font-medium">
                      {t('localData.syncMatch')}
                    </Label>
                    <Input
                      type="text"
                      onChange={(e) => setMatchId(e.target.value)}
                      placeholder={t('localData.matchId')}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSyncing && !matchId}
                    onClick={() => matchId && performMatchSync()}
                    className="w-full sm:w-auto sm:self-end"
                  >
                    {t('localData.synchronize')}
                  </Button>
                </div>
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
                    onClick={() => handleResetLocalStats()}
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
                    onClick={() => handleResetLocalMatches()}
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
                    onClick={() => handleResetLocalTeams()}
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
                  disabled={isDeletingCache}
                  onClick={() => handleResetLocalCache()}
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
