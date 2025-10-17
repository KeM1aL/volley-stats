"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
];

export default function SettingsPage() {
  const { localDb: db } = useLocalDb();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingCache, setIsDeletingCache] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    settings,
    isLoading: isLoadingSettings,
    updateSettings,
    resetSettings,
  } = useSettings();

  const form = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    const loadTeams = async () => {
      if (!db) return;

      try {
        const teamDocs = await db.teams.find().exec();
        setTeams(teamDocs.map((doc) => doc.toJSON()));
      } catch (error) {
        console.error("Failed to load teams:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load teams",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [db]);

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
          title: "Match synchronization",
          description: "Matches data has been synchronized",
        });
      }
      const collections = new Map<CollectionName, RxCollection>([
        ["sets", db.sets],
        ["player_stats", db.player_stats],
        ["score_points", db.score_points],
        ["substitutions", db.substitutions],
        ["events", db.events],
        ["team_members", db.team_members],
      ]);
      const entries = Array.from(collections.entries());
      for (const [name, collection] of entries) {
        const docs = await collection
          .find({
            selector: {
              match_id: matchId,
            },
            sort: [{ created_at: "asc" }],
          })
          .exec();
        toast({
          title: "Match synchronization",
          description: `${name} ${docs.length} data to be synchronized`,
        });
        if (docs) {
          const data = Array.from(docs.values()).map((doc) => doc.toJSON());

          const chunks = chunk(data, 20);
          const chunkSize = chunks.length;
          for (let index = 0; index < chunkSize; index++) {
            const chunk = chunks[index];

            const { error: updateError } = await supabase
              .from(name)
              .upsert(chunk)
              .select();
            if (updateError) throw updateError;
            toast({
              title: "Match synchronization",
              description: `${name} ${index}/${chunkSize} data has been synchronized`,
            });
            await delay(1000);
          }
          await delay(1000);
        }
        toast({
          title: "Match synchronization",
          description: "All data has been synchronized",
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Failed to sync match. Please try again." + JSON.stringify(error),
      });
    } finally {
      setMatchId(null);
      setIsSyncing(false);
    }
  };

  const onSubmit = async (values: Settings) => {
    setIsSaving(true);
    try {
      const result = await updateSettings(values);
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetLocalStats = (loadingIndicator: boolean = true) => {
    if (loadingIndicator) setIsDeletingCache(true);
    try {
      db!.substitutions?.remove();
      db!.score_points?.remove();
      db!.player_stats?.remove();
      if (loadingIndicator) {
        toast({
          title: "Cache cleared",
          description: "Your local statistics cache has been cleared",
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
          title: "Cache cleared",
          description: "Your local matches cache has been cleared",
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
          title: "Cache cleared",
          description: "Your local teams cache has been cleared",
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
        title: "Cache cleared",
        description: "Your local cache has been cleared",
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
      title: "Settings reset",
      description: "Your preferences have been reset to default values.",
    });
  };

  if (isLoading || isLoadingSettings) {
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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your preferences and notifications
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="favoriteTeam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Favorite Team</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This team will be highlighted in match listings
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a language" />
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

              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a theme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {db && (
                <div className="space-y-4">
                  <Label>Local data</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">
                          Synchronize Match
                        </Label>
                        <Input
                          type="text"
                          onChange={(e) => setMatchId(e.target.value)}
                          placeholder="Match ID"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSyncing && !matchId}
                        onClick={() => matchId && performMatchSync()}
                      >
                        Synchronize
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">
                          Clear Local Stats
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Clear the local stats cache
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleResetLocalStats()}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">
                          Clear Local Matches
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Clear the local matches cache
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleResetLocalMatches()}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">
                          Clear Local Teams
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Clear the local teams cache
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleResetLocalTeams()}
                      >
                        Clear
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
                          Deleting...
                        </>
                      ) : (
                        "Clear All"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <FormLabel>Notifications</FormLabel>
                <FormField
                  control={form.control}
                  name="notifications.matchReminders"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Match Reminders</FormLabel>
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
                        <FormLabel>Score Updates</FormLabel>
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
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetSettings}
                  disabled={isSaving}
                >
                  Reset to Defaults
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
