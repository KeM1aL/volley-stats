"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { removeRxDatabase } from "rxdb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GenericSelect } from "@/components/ui/generic-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/lib/supabase/client";
import { clearCachedUser } from "@/lib/auth/user-cache";
import { LOCALE_ADOPTED_KEY, LOCALE_STORAGE_KEY } from "@/lib/i18n/resolve-locale";
import { getDatabaseName, getStorage } from "@/lib/rxdb/database";
import {
  buildDecisions,
  parseDeleteAccountError,
  teamsToDecide,
  type TeamChoice,
  type TeamToDecide,
} from "@/lib/auth/delete-account";
import type { UnsentBreakdown } from "@/hooks/use-unsent-guard";

const DELETE = "delete";

interface DeleteAccountCardProps {
  email: string;
  userId: string;
  /** Live-match changes not uploaded, pending and refused; null while unknown (the local database is not open). */
  unsentChanges: UnsentBreakdown | null;
  /** Drops the changes the server refused (SyncManager.discardRejected). */
  onDiscardRejected: () => Promise<number>;
}

export function DeleteAccountCard({ email, userId, unsentChanges, onDiscardRejected }: DeleteAccountCardProps) {
  const t = useTranslations("settings.deleteAccount");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [teams, setTeams] = useState<TeamToDecide[]>([]);
  const [choices, setChoices] = useState<Record<string, TeamChoice | undefined>>({});
  const [typedEmail, setTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);

  // Unknown, pending or refused changes all block. Pending ones upload by themselves; refused ones
  // never will, so only those can be discarded, and only once nothing is pending.
  const pendingCount = unsentChanges?.pending ?? 0;
  const rejectedCount = unsentChanges?.rejected ?? 0;
  const blocked = unsentChanges === null || pendingCount > 0 || rejectedCount > 0;
  const onlyRejected = unsentChanges !== null && pendingCount === 0 && rejectedCount > 0;
  const blockedMessage = onlyRejected ? t("rejectedBlocked", { count: rejectedCount }) : t("unsentBlocked");
  const decisions = useMemo(() => buildDecisions(teams, choices), [teams, choices]);
  const emailMatches = typedEmail.trim().toLowerCase() === email.trim().toLowerCase();
  const canConfirm = !blocked && !loading && !loadFailed && !deleting && decisions !== null && emailMatches;

  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data: owned, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("user_id", userId)
        .eq("_deleted", false);
      if (teamsError) throw teamsError;
      const ownedTeams = owned ?? [];
      let members: Parameters<typeof teamsToDecide>[1] = [];
      if (ownedTeams.length > 0) {
        const { data, error } = await supabase
          .from("team_members")
          .select("team_id, user_id, name, archived_at, _deleted")
          .in("team_id", ownedTeams.map((team) => team.id));
        if (error) throw error;
        members = data ?? [];
      }
      setTeams(teamsToDecide(ownedTeams, members, userId));
    } catch (error) {
      console.error("Could not load the teams to decide:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const discardRejected = async () => {
    setDiscarding(true);
    setDiscardFailed(false);
    try {
      await onDiscardRejected();
      setDiscardOpen(false);
    } catch (error) {
      console.error("Could not discard the refused changes:", error);
      setDiscardFailed(true);
    } finally {
      setDiscarding(false);
    }
  };

  const openDialog = () => {
    setTeams([]);
    setChoices({});
    setTypedEmail("");
    setFailed(false);
    setOpen(true);
    void load();
  };

  const choose = (teamId: string, value: string) => {
    setChoices((previous) => ({
      ...previous,
      [teamId]: value === "" ? undefined : value === DELETE ? { action: "delete" } : { action: "transfer", newOwner: value },
    }));
  };

  const confirm = async () => {
    if (!decisions) return;
    setDeleting(true);
    setFailed(false);
    const { error } = await supabase.rpc("delete_my_account", { decisions });
    const result = parseDeleteAccountError(error);
    if (!result.ok) {
      console.error("Account deletion failed:", result.message);
      setFailed(true);
      setDeleting(false);
      return;
    }
    // The account is gone: forget this device's traces of it, then reload (nothing is unsent, see the button guard).
    clearCachedUser();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The session is already invalid on the server.
    }
    try {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
      localStorage.removeItem(LOCALE_ADOPTED_KEY);
    } catch {
      // Storage unavailable: nothing to remove.
    }
    try {
      await removeRxDatabase(getDatabaseName(), getStorage());
    } catch (removeError) {
      console.warn("Could not remove the local database:", removeError);
    }
    window.location.assign(new URL("/auth?account-deleted=1", window.location.origin).href);
  };

  return (
    <Card data-testid="delete-account-card">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-lg font-semibold">{t("title")}</h3>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            {blocked && (
              <p className="text-sm text-destructive" data-testid="delete-account-blocked">
                {blockedMessage}
              </p>
            )}
            {onlyRejected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setDiscardFailed(false);
                  setDiscardOpen(true);
                }}
                data-testid="discard-rejected-button"
              >
                {t("discardRejected")}
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={blocked}
            onClick={openDialog}
            className="w-full sm:w-auto"
            data-testid="delete-account-button"
          >
            {t("button")}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto" data-testid="delete-account-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <p>{t("deleted")}</p>
                <p>{t("kept")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {loading && (
            <div className="flex justify-center py-4" data-testid="delete-account-loading">
              <LoadingSpinner />
            </div>
          )}

          {!loading && teams.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("teamsIntro")}</p>
              {teams.map(({ team, candidates }) => {
                const choice = choices[team.id];
                const value = choice ? (choice.action === "delete" ? DELETE : choice.newOwner) : "";
                return (
                  <div key={team.id} className="space-y-1 rounded-lg border p-3" data-testid="delete-account-team" data-team-id={team.id}>
                    <p className="font-medium">{team.name}</p>
                    <GenericSelect
                      options={[
                        { value: DELETE, label: t("deleteTeam") },
                        ...candidates.map((candidate) => ({ value: candidate.userId, label: t("handOver", { name: candidate.name }) })),
                      ]}
                      placeholder={t("choosePlaceholder")}
                      value={value}
                      onValueChange={(next) => choose(team.id, next)}
                    />
                    {candidates.length === 0 && <p className="text-sm text-muted-foreground">{t("noCandidate")}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !loadFailed && (
            <div className="space-y-2">
              <Label htmlFor="delete-account-email">{t("confirmLabel")}</Label>
              <Input
                id="delete-account-email"
                type="email"
                autoComplete="off"
                value={typedEmail}
                onChange={(event) => setTypedEmail(event.target.value)}
              />
            </div>
          )}

          {blocked && (
            <p className="text-sm text-destructive" data-testid="delete-account-dialog-blocked">
              {blockedMessage}
            </p>
          )}

          {(failed || loadFailed) && (
            <p className="text-sm text-destructive" data-testid="delete-account-error">
              {t("failed")}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={!canConfirm} onClick={() => void confirm()} data-testid="delete-account-confirm">
              {deleting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              {t("confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardOpen} onOpenChange={(next) => !discarding && setDiscardOpen(next)}>
        <AlertDialogContent data-testid="discard-rejected-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("discardBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {discardFailed && (
            <p className="text-sm text-destructive" data-testid="discard-rejected-error">
              {t("discardFailed")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>{t("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={discarding}
              onClick={() => void discardRejected()}
              data-testid="discard-rejected-confirm"
            >
              {discarding ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              {t("discardConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
